import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_LIMITS, parseAmount } from "@/lib/payments";
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

type Payload = {
  amount?: number;
  method?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }

  const session = verifySessionToken(cookieStore.get(getSessionCookieName())?.value);
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const idempotency = await beginIdempotentRequest({
    scope: `payments:withdraw:${session.userId}`,
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
    key: `payments:withdraw:${session.userId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return await finalize(
      { message: `Too many withdrawal requests. Retry in ${limiter.retryAfterSec}s.` },
      429,
    );
  }

  const body = (await request.json()) as Payload;
  const amount = parseAmount(body.amount);
  const method = body.method?.trim() || "manual";

  if (!amount || amount < PAYMENT_LIMITS.minWithdraw || amount > PAYMENT_LIMITS.maxWithdraw) {
    return await finalize(
      { message: `Withdraw amount must be between ${PAYMENT_LIMITS.minWithdraw} and ${PAYMENT_LIMITS.maxWithdraw}.` },
      400,
    );
  }

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          balance: true,
          emailVerifiedAt: true,
          kycStatus: true,
        },
      });
      if (!user) throw new Error("USER_NOT_FOUND");
      if (!user.emailVerifiedAt || user.kycStatus !== "verified") {
        throw new Error("KYC_REQUIRED");
      }

      const currentBalance = Number(user.balance);
      if (currentBalance < amount) throw new Error("INSUFFICIENT_BALANCE");

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const daily = await tx.walletTransaction.aggregate({
        where: {
          userId: user.id,
          kind: "withdrawal",
          status: { in: ["pending", "completed"] },
          createdAt: { gte: dayStart },
        },
        _sum: { amount: true },
      });
      const dailyUsed = Number(daily._sum.amount ?? 0);
      if (dailyUsed + amount > PAYMENT_LIMITS.dailyWithdrawLimit) {
        throw new Error("DAILY_LIMIT");
      }

      const updatedBalance = Number((currentBalance - amount).toFixed(2));
      await tx.user.update({
        where: { id: user.id },
        data: { balance: updatedBalance },
      });

      await tx.walletLedger.create({
        data: {
          userId: user.id,
          type: "DEBIT",
          amount,
          reason: "WITHDRAWAL_HOLD",
        },
      });

      return tx.walletTransaction.create({
        data: {
          userId: user.id,
          kind: "withdrawal",
          amount,
          status: "pending",
          method,
        },
      });
    });

    return await finalize({
      message: "Withdrawal request submitted.",
      transaction: { ...transaction, amount: Number(transaction.amount) },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "KYC_REQUIRED") {
      return await finalize({ message: "Withdrawals require verified email and KYC." }, 400);
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return await finalize({ message: "Insufficient balance." }, 400);
    }
    if (error instanceof Error && error.message === "DAILY_LIMIT") {
      return await finalize(
        { message: `Daily withdrawal limit exceeded (${PAYMENT_LIMITS.dailyWithdrawLimit}).` },
        400,
      );
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return await finalize({ message: "User not found." }, 404);
    }
    console.error("Withdraw request error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to create withdrawal request." }, { status: 500 });
  }
}
