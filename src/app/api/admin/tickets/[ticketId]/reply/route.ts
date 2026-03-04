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
  message?: string;
  isInternal?: boolean;
};

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
    scope: `admin:tickets:reply:${ticketId}`,
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
    const message = body.message?.trim() ?? "";
    const isInternal = Boolean(body.isInternal);

    if (!message || message.length < 2) {
      return await finalize({ message: "Message is required." }, 400);
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, firstResponseAt: true, status: true },
    });
    if (!ticket) {
      return await finalize({ message: "Ticket not found." }, 404);
    }
    if (ticket.status === "closed") {
      return await finalize({ message: "Closed tickets cannot be updated." }, 400);
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorRole: "admin",
          isInternal,
          message,
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          firstResponseAt: ticket.firstResponseAt ?? now,
          status: isInternal ? ticket.status : "waiting_on_player",
        },
      }),
    ]);

    return await finalize({ message: "Reply posted." });
  } catch (error) {
    console.error("Admin ticket reply error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to post reply." }, { status: 500 });
  }
}
