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

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
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

  const idempotency = await beginIdempotentRequest({
    scope: `auth:email-verify-send:${session.userId}`,
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
    key: `auth:email-verify-send:${session.userId}`,
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return await finalize(
      { message: `Too many requests. Retry in ${limiter.retryAfterSec}s.` },
      429,
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, emailVerifiedAt: true },
    });

    if (!user) {
      return await finalize({ message: "User not found." }, 404);
    }

    if (user.emailVerifiedAt) {
      return await finalize({ message: "Email already verified." }, 200);
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt,
      },
    });

    // In production this must be sent via email provider.
    const response: { message: string; code?: string } = {
      message: "Verification code sent.",
    };
    if (process.env.NODE_ENV !== "production") {
      response.code = code;
    }

    return await finalize(response);
  } catch (error) {
    console.error("Send verification error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to send verification code." }, { status: 500 });
  }
}
