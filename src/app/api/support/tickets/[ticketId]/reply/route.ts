import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
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

  const session = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { ticketId } = await context.params;

  const idempotency = await beginIdempotentRequest({
    scope: `support:reply:${session.userId}:${ticketId}`,
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
    if (!message || message.length < 2) {
      return await finalize({ message: "Message is required." }, 400);
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true },
    });
    if (!ticket || ticket.userId !== session.userId) {
      return await finalize({ message: "Ticket not found." }, 404);
    }
    if (ticket.status === "closed") {
      return await finalize({ message: "Closed tickets cannot be updated." }, 400);
    }

    await prisma.$transaction([
      prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorUserId: session.userId,
          authorRole: "player",
          isInternal: false,
          message,
        },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: ticket.status === "resolved" ? "reopened" : "waiting_on_admin",
        },
      }),
    ]);

    return await finalize({ message: "Reply posted." });
  } catch (error) {
    console.error("Support ticket reply error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to post reply." }, { status: 500 });
  }
}
