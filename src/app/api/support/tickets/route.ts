import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { verifyCsrf } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  beginIdempotentRequest,
  commitIdempotentResponse,
  getIdempotencyKey,
  releaseIdempotentLock,
} from "@/lib/idempotency";

export const runtime = "nodejs";

type CreatePayload = {
  category?: string;
  subject?: string;
  description?: string;
  priority?: string;
};

const ALLOWED_CATEGORIES = new Set(["payment", "withdrawal", "kyc", "account", "bonus", "technical", "other"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

export async function GET() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      category: true,
      subject: true,
      priority: true,
      status: true,
      assigneeAdminId: true,
      firstResponseAt: true,
      resolvedAt: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorRole: true,
          isInternal: true,
          message: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }

  const session = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `support:create:${session.userId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json({ message: `Too many tickets. Retry in ${limiter.retryAfterSec}s.` }, { status: 429 });
  }

  const idempotency = await beginIdempotentRequest({
    scope: `support:create:${session.userId}`,
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
    const body = (await request.json()) as CreatePayload;
    const category = (body.category ?? "other").trim().toLowerCase();
    const priority = (body.priority ?? "medium").trim().toLowerCase();
    const subject = body.subject?.trim() ?? "";
    const description = body.description?.trim() ?? "";

    if (!ALLOWED_CATEGORIES.has(category)) {
      return await finalize({ message: "Invalid category." }, 400);
    }
    if (!ALLOWED_PRIORITIES.has(priority)) {
      return await finalize({ message: "Invalid priority." }, 400);
    }
    if (!subject || subject.length < 4) {
      return await finalize({ message: "Subject must be at least 4 characters." }, 400);
    }
    if (!description || description.length < 10) {
      return await finalize({ message: "Description must be at least 10 characters." }, 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          userId: session.userId,
          category,
          subject,
          description,
          priority,
          status: "open",
        },
        select: {
          id: true,
          category: true,
          subject: true,
          priority: true,
          status: true,
          createdAt: true,
        },
      });

      await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorUserId: session.userId,
          authorRole: "player",
          isInternal: false,
          message: description,
        },
      });

      return ticket;
    });

    return await finalize({ message: "Ticket created.", ticket: created }, 201);
  } catch (error) {
    console.error("Create support ticket error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to create ticket." }, { status: 500 });
  }
}
