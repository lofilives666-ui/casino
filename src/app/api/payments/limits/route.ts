import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_LIMITS } from "@/lib/payments";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      emailVerifiedAt: true,
      kycStatus: true,
    },
  });
  if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

  return NextResponse.json({
    ...PAYMENT_LIMITS,
    gates: {
      emailVerified: Boolean(user.emailVerifiedAt),
      kycVerified: user.kycStatus === "verified",
      canWithdraw: Boolean(user.emailVerifiedAt) && user.kycStatus === "verified",
    },
  });
}

