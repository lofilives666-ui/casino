import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { createKycCase } from "@/lib/kyc-provider";

export const runtime = "nodejs";

type SubmitPayload = {
  submissionId?: string;
};

export async function POST(request: Request) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `kyc:submit:${session.userId}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Too many submit attempts. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const body = (await request.json()) as SubmitPayload;
  if (!body.submissionId) {
    return NextResponse.json({ message: "submissionId is required." }, { status: 400 });
  }

  const submission = await prisma.kycSubmission.findFirst({
    where: { id: body.submissionId, userId: session.userId },
  });
  if (!submission) {
    return NextResponse.json({ message: "KYC submission not found." }, { status: 404 });
  }

  if (!submission.docType || !submission.idFrontUrl || !submission.selfieUrl || !submission.addressProofUrl) {
    return NextResponse.json({ message: "Please upload required document metadata before submit." }, { status: 400 });
  }

  const providerCase = await createKycCase({
    submissionId: submission.id,
    userId: session.userId,
    legalName: submission.legalName,
    country: submission.country,
  });

  await prisma.$transaction([
    prisma.kycSubmission.update({
      where: { id: submission.id },
      data: {
        status: "provider_review",
        submittedAt: new Date(),
        provider: providerCase.provider,
        providerCaseId: providerCase.providerCaseId,
        providerStatus: providerCase.providerStatus,
        amlStatus: "pending",
      },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { kycStatus: "pending_review" },
    }),
  ]);

  return NextResponse.json({
    message: "KYC submitted to provider.",
    provider: providerCase.provider,
    providerCaseId: providerCase.providerCaseId,
  });
}
