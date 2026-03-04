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

type ReviewPayload = {
  submissionId?: string;
  decision?: "verified" | "rejected";
  notes?: string;
};

function isAuthorized(request: Request) {
  return isAdminApiAuthorized(request.headers);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending_review";

  const submissions = await prisma.kycSubmission.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      status: true,
      legalName: true,
      dob: true,
      country: true,
      addressLine1: true,
      city: true,
      postalCode: true,
      docType: true,
      idNumber: true,
      idFrontUrl: true,
      idBackUrl: true,
      selfieUrl: true,
      addressProofUrl: true,
      reviewNotes: true,
      submittedAt: true,
      createdAt: true,
      user: {
        select: {
          fullName: true,
          email: true,
          kycStatus: true,
        },
      },
    },
  });

  return NextResponse.json({ submissions });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyCsrf(request, cookieStore)) {
    return NextResponse.json({ message: "CSRF validation failed." }, { status: 403 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const idempotency = await beginIdempotentRequest({
    scope: "admin:kyc:review",
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

  const body = (await request.json()) as ReviewPayload;
  if (!body.submissionId || !body.decision) {
    return await finalize({ message: "submissionId and decision are required." }, 400);
  }

  const submission = await prisma.kycSubmission.findUnique({
    where: { id: body.submissionId },
    select: { id: true, userId: true },
  });
  if (!submission) {
    return await finalize({ message: "KYC submission not found." }, 404);
  }

  const decision = body.decision === "verified" ? "verified" : "rejected";
  const reviewNotes = body.notes?.trim() || null;
  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.kycSubmission.update({
        where: { id: submission.id },
        data: {
          status: decision,
          reviewedAt: now,
          reviewNotes,
        },
      }),
      prisma.user.update({
        where: { id: submission.userId },
        data: { kycStatus: decision },
      }),
    ]);

    return await finalize({ message: `KYC ${decision}.` });
  } catch (error) {
    console.error("KYC review error:", error);
    await releaseIdempotentLock(idempotency);
    return NextResponse.json({ message: "Unable to process KYC review." }, { status: 500 });
  }
}
