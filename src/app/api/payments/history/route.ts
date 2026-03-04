import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    transactions: transactions.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
    })),
  });
}

