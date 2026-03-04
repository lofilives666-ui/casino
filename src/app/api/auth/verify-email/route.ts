import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyCsrf } from "@/lib/csrf";
import {
  beginIdempotentRequest,
  commitIdempotentResponse,
  getIdempotencyKey,
  releaseIdempotentLock,
} from "@/lib/idempotency";

export const runtime = "nodejs";

type VerifyBody = {
  code?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }

  const session = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const idempotency = await beginIdempotentRequest({
    scope: `auth:email-verify-check:${session.userId}`,
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

  const limiter = checkRateLimit({
    key: `auth:email-verify-check:${session.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return await finalize(
      { message: `Too many attempts. Retry in ${limiter.retryAfterSec}s.` },
      429,
    );
  }

  try {
    const body = (await request.json()) as VerifyBody;
    const code = body.code?.trim() ?? "";
    if (!code) {
      return await finalize({ message: "Code is required." }, 400);
    }

    const now = new Date();
    const verification = await prisma.emailVerificationCode.findFirst({
      where: {
        userId: session.userId,
        code,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return await finalize({ message: "Invalid or expired code." }, 400);
    }

    await prisma.$transaction([
      prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: { usedAt: now },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { emailVerifiedAt: now },
      }),
    ]);

    return await finalize({ message: "Email verified successfully." });
  } catch (error) {
    console.error("Verify email error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to verify email." }, { status: 500 });
  }
}
