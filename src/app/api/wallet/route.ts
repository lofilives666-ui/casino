import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, balance: true, emailVerifiedAt: true, twoFactorEnabled: true },
  });
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      amount: true,
      currency: true,
      status: true,
      method: true,
      provider: true,
      failureReason: true,
      requestedAt: true,
      processedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    balance: Number(user.balance),
    emailVerified: Boolean(user.emailVerifiedAt),
    twoFactorEnabled: user.twoFactorEnabled,
    transactions: transactions.map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
  });
}
