import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type UploadPayload = {
  submissionId?: string;
  docType?: string;
  idNumber?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  addressProofUrl?: string;
};

export async function POST(request: Request) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `kyc:upload-meta:${session.userId}`,
    limit: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Too many document updates. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const body = (await request.json()) as UploadPayload;
  if (!body.submissionId) {
    return NextResponse.json({ message: "submissionId is required." }, { status: 400 });
  }

  const existing = await prisma.kycSubmission.findFirst({
    where: {
      id: body.submissionId,
      userId: session.userId,
    },
  });
  if (!existing) {
    return NextResponse.json({ message: "KYC submission not found." }, { status: 404 });
  }

  const updated = await prisma.kycSubmission.update({
    where: { id: existing.id },
    data: {
      docType: body.docType?.trim() || existing.docType,
      idNumber: body.idNumber?.trim() || existing.idNumber,
      idFrontUrl: body.idFrontUrl?.trim() || existing.idFrontUrl,
      idBackUrl: body.idBackUrl?.trim() || existing.idBackUrl,
      selfieUrl: body.selfieUrl?.trim() || existing.selfieUrl,
      addressProofUrl: body.addressProofUrl?.trim() || existing.addressProofUrl,
    },
  });

  return NextResponse.json({
    message: "KYC document metadata saved.",
    submissionId: updated.id,
  });
}
