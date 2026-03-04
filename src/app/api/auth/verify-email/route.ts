import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type VerifyBody = {
  code?: string;
};

export async function POST(request: Request) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `auth:email-verify-check:${session.userId}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Too many attempts. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const body = (await request.json()) as VerifyBody;
  const code = body.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ message: "Code is required." }, { status: 400 });
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
    return NextResponse.json({ message: "Invalid or expired code." }, { status: 400 });
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

  return NextResponse.json({ message: "Email verified successfully." });
}
