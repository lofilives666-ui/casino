import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `auth:email-verify-send:${session.userId}`,
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Too many requests. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, emailVerifiedAt: true },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({ message: "Email already verified." }, { status: 200 });
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

  return NextResponse.json(response);
}
