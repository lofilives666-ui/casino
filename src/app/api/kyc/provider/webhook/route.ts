import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KycProviderWebhookEvent, verifyKycWebhookSignature } from "@/lib/kyc-provider";

export const runtime = "nodejs";

function parseEvent(raw: string) {
  try {
    return JSON.parse(raw) as KycProviderWebhookEvent;
  } catch {
    return null;
  }
}

function mapUserKycStatus(kycStatus: string, amlStatus: string) {
  if (kycStatus === "verified" && amlStatus === "clear") return "verified";
  if (kycStatus === "rejected" || amlStatus === "blocked") return "rejected";
  return "pending_review";
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-kyc-signature");
  if (!verifyKycWebhookSignature(raw, signature)) {
    return NextResponse.json({ message: "Invalid webhook signature." }, { status: 401 });
  }

  const event = parseEvent(raw);
  if (!event?.id || !event?.type || !event?.data?.providerCaseId) {
    return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.kycProviderEvent.create({
        data: {
          provider: "mockkyc",
          providerEventId: event.id,
          eventType: event.type,
          payload: event,
        },
      });

      const submission = await tx.kycSubmission.findFirst({
        where: {
          provider: "mockkyc",
          providerCaseId: event.data.providerCaseId,
        },
        orderBy: { createdAt: "desc" },
      });
      if (!submission) return;

      let nextKycStatus = submission.status;
      let nextProviderStatus = submission.providerStatus ?? "submitted";
      let nextAmlStatus = submission.amlStatus ?? "pending";

      if (event.type === "kyc.approved") {
        nextKycStatus = "verified";
        nextProviderStatus = "approved";
      }
      if (event.type === "kyc.rejected") {
        nextKycStatus = "rejected";
        nextProviderStatus = "rejected";
      }
      if (event.type === "kyc.needs_info") {
        nextKycStatus = "needs_info";
        nextProviderStatus = "needs_info";
      }
      if (event.type === "aml.clear") nextAmlStatus = "clear";
      if (event.type === "aml.review") nextAmlStatus = "review";
      if (event.type === "aml.blocked") nextAmlStatus = "blocked";

      const nextAmlFlags: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
        event.data.flags !== undefined
          ? (event.data.flags as Prisma.InputJsonValue)
          : submission.amlFlags === null
            ? Prisma.JsonNull
            : (submission.amlFlags as Prisma.InputJsonValue);

      await tx.kycSubmission.update({
        where: { id: submission.id },
        data: {
          status: nextKycStatus,
          providerStatus: nextProviderStatus,
          amlStatus: nextAmlStatus,
          riskLevel: event.data.riskLevel ?? submission.riskLevel,
          riskScore: event.data.riskScore ?? submission.riskScore,
          amlFlags: nextAmlFlags,
          reviewNotes: event.data.note ?? submission.reviewNotes,
          reviewedAt:
            nextKycStatus === "verified" || nextKycStatus === "rejected" ? new Date() : submission.reviewedAt,
        },
      });

      await tx.user.update({
        where: { id: submission.userId },
        data: {
          kycStatus: mapUserKycStatus(nextKycStatus, nextAmlStatus),
        },
      });
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
    console.error("KYC provider webhook error:", error);
    return NextResponse.json({ message: "Webhook handling failed." }, { status: 500 });
  }
}
