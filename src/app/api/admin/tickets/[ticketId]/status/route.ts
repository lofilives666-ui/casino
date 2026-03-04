import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminApiAuthorized } from "@/lib/admin-auth";
import { verifyCsrf } from "@/lib/csrf";
import {
  beginIdempotentRequest,
  commitIdempotentResponse,
  getIdempotencyKey,
  releaseIdempotentLock,
} from "@/lib/idempotency";

export const runtime = "nodejs";

type Payload = {
  status?: string;
  assigneeAdminId?: string | null;
};

const ALLOWED_STATUSES = new Set([
  "open",
  "in_progress",
  "waiting_on_player",
  "waiting_on_admin",
  "escalated",
  "resolved",
  "closed",
  "reopened",
]);

export async function POST(
  request: Request,
  context: {
    params: Promise<{ ticketId: string }>;
  },
) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { ticketId } = await context.params;
  const idempotency = await beginIdempotentRequest({
    scope: `admin:tickets:status:${ticketId}`,
    key: getIdempotencyKey(request),
  });
  if (!idempotency.ok && idempotency.reason === "INVALID_KEY") {
    return NextResponse.json({ message: "A valid x-idempotency-key header is required." }, { status: 400 });
  }
  if (!idempotency.ok && idempotency.response) {
    return NextResponse.json(idempotency.response.body, {
      status: idempotency.response.status,
      headers: { "x-idempotent-replayed": "1" },
    });
  }
  if (!idempotency.ok && idempotency.reason === "IN_PROGRESS") {
    return NextResponse.json({ message: "Request already in progress for this idempotency key." }, { status: 409 });
  }
  const finalize = async (body: unknown, status = 200) => {
    await commitIdempotentResponse({ token: idempotency, status, body });
    return NextResponse.json(body, { status });
  };

  try {
    const body = (await request.json()) as Payload;
    const nextStatus = (body.status ?? "").trim();
    const assigneeAdminId = body.assigneeAdminId?.trim() || null;

    if (!nextStatus || !ALLOWED_STATUSES.has(nextStatus)) {
      return await finalize({ message: "Invalid status." }, 400);
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      return await finalize({ message: "Ticket not found." }, 404);
    }

    const now = new Date();
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        assigneeAdminId,
        resolvedAt: nextStatus === "resolved" ? now : null,
        closedAt: nextStatus === "closed" ? now : null,
      },
      select: {
        id: true,
        status: true,
        assigneeAdminId: true,
        resolvedAt: true,
        closedAt: true,
        updatedAt: true,
      },
    });

    return await finalize({ message: "Ticket updated.", ticket: updated });
  } catch (error) {
    console.error("Admin ticket status error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to update ticket." }, { status: 500 });
  }
}
