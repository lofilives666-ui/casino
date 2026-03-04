import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_LIMITS, parseAmount } from "@/lib/payments";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyCsrf } from "@/lib/csrf";
import { createDepositSession } from "@/lib/payment-provider";
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
    scope: `payments:deposit:${session.userId}`,
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
    key: `payments:deposit:${session.userId}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return await finalize(
      { message: `Too many deposit requests. Retry in ${limiter.retryAfterSec}s.` },
      429,
    );
  }

  const body = (await request.json()) as Payload;
  const amount = parseAmount(body.amount);
  const method = body.method?.trim() || "manual";

  if (!amount || amount < PAYMENT_LIMITS.minDeposit || amount > PAYMENT_LIMITS.maxDeposit) {
    return await finalize(
      { message: `Deposit amount must be between ${PAYMENT_LIMITS.minDeposit} and ${PAYMENT_LIMITS.maxDeposit}.` },
      400,
    );
  }

  try {
    const tx = await prisma.walletTransaction.create({
      data: {
        userId: session.userId,
        kind: "deposit",
        amount,
        status: "pending",
        method,
        provider: "mockpay",
      },
    });

    const sessionInfo = await createDepositSession({
      transactionId: tx.id,
      userId: session.userId,
      amount,
      currency: tx.currency,
      method,
    });

    const updated = await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: {
        provider: sessionInfo.provider,
        providerRef: sessionInfo.providerRef,
      },
    });

    return await finalize({
      message: "Deposit request created. Proceed to checkout.",
      transaction: {
        ...updated,
        amount: Number(updated.amount),
      },
      checkout: {
        url: sessionInfo.checkoutUrl,
        provider: sessionInfo.provider,
        providerRef: sessionInfo.providerRef,
        expiresAt: sessionInfo.expiresAt,
      },
    });
  } catch (error) {
    console.error("Deposit request error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to create deposit request." }, { status: 500 });
  }
}
