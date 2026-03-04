import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminApiAuthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  const kind = url.searchParams.get("kind");

  const transactions = await prisma.walletTransaction.findMany({
    where: {
      status,
      ...(kind ? { kind } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      kind: true,
      amount: true,
      currency: true,
      status: true,
      method: true,
      provider: true,
      providerRef: true,
      requestedAt: true,
      processedAt: true,
      failureReason: true,
      createdAt: true,
      user: {
        select: {
          fullName: true,
          email: true,
          balance: true,
          kycStatus: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    transactions: transactions.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
      user: {
        ...tx.user,
        balance: Number(tx.user.balance),
      },
    })),
  });
}

