import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminApiAuthorized } from "@/lib/admin-auth";
import { verifyCsrf } from "@/lib/csrf";
import {
  beginIdempotentRequest,
  commitIdempotentResponse,
  getIdempotencyKey,
  releaseIdempotentLock,
} from "@/lib/idempotency";

export const runtime = "nodejs";

type Payload = {
  transactionId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }

  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const idempotency = await beginIdempotentRequest({
    scope: "admin:payments:reject",
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

  const body = (await request.json()) as Payload;
  if (!body.transactionId) {
    return await finalize({ message: "transactionId is required." }, 400);
  }

  const rejectionReason = body.reason?.trim() || "Rejected by admin";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({
        where: { id: body.transactionId },
      });
      if (!transaction) throw new Error("NOT_FOUND");
      if (transaction.status !== "pending") throw new Error("INVALID_STATE");

      const amount = Number(transaction.amount);

      if (transaction.kind === "withdrawal") {
        const user = await tx.user.findUnique({
          where: { id: transaction.userId },
          select: { balance: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");
        const nextBalance = Number((Number(user.balance) + amount).toFixed(2));

        await tx.user.update({
          where: { id: transaction.userId },
          data: { balance: nextBalance },
        });

        await tx.walletLedger.create({
          data: {
            userId: transaction.userId,
            type: "CREDIT",
            amount,
            reason: "WITHDRAWAL_RELEASE",
            reference: transaction.id,
          },
        });
      }

      const updated = await tx.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "failed",
          processedAt: new Date(),
          failureReason: rejectionReason,
        },
      });
      return updated;
    });

    return await finalize({
      message: "Transaction rejected.",
      transaction: { ...result, amount: Number(result.amount) },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return await finalize({ message: "Transaction not found." }, 404);
    }
    if (error instanceof Error && error.message === "INVALID_STATE") {
      return await finalize({ message: "Only pending transactions can be rejected." }, 400);
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return await finalize({ message: "User not found." }, 404);
    }
    console.error("Reject payment error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to reject transaction." }, { status: 500 });
  }
}
