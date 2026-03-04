import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProviderWebhookEvent, verifyWebhookSignature } from "@/lib/payment-provider";

export const runtime = "nodejs";

function parseEvent(raw: string) {
  try {
    return JSON.parse(raw) as ProviderWebhookEvent;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-payment-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ message: "Invalid webhook signature." }, { status: 401 });
  }

  const event = parseEvent(raw);
  if (!event?.id || !event?.type || !event?.data?.providerRef) {
    return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.create({
        data: {
          provider: "mockpay",
          providerEventId: event.id,
          eventType: event.type,
          payload: event,
        },
      });

      const transaction = await tx.walletTransaction.findFirst({
        where: {
          provider: "mockpay",
          providerRef: event.data.providerRef,
        },
      });
      if (!transaction) return;
      if (transaction.status !== "pending") return;

      const amount = Number(transaction.amount);
      const now = new Date();

      if (event.type === "deposit.succeeded" && transaction.kind === "deposit") {
        const user = await tx.user.findUnique({
          where: { id: transaction.userId },
          select: { balance: true },
        });
        if (!user) return;
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
            reason: "DEPOSIT_COMPLETED",
            reference: transaction.id,
          },
        });
        await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: { status: "completed", processedAt: now },
        });
        return;
      }

      if (event.type === "deposit.failed" && transaction.kind === "deposit") {
        await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "failed",
            processedAt: now,
            failureReason: event.data.reason?.trim() || "Provider rejected deposit",
          },
        });
        return;
      }

      if (event.type === "withdrawal.succeeded" && transaction.kind === "withdrawal") {
        await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: { status: "completed", processedAt: now },
        });
        return;
      }

      if (event.type === "withdrawal.failed" && transaction.kind === "withdrawal") {
        const user = await tx.user.findUnique({
          where: { id: transaction.userId },
          select: { balance: true },
        });
        if (!user) return;
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
        await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "failed",
            processedAt: now,
            failureReason: event.data.reason?.trim() || "Provider rejected withdrawal",
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ ok: true, replayed: true });
    }
    console.error("Payment webhook error:", error);
    return NextResponse.json({ message: "Webhook handling failed." }, { status: 500 });
  }
}

