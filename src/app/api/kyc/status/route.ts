import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      kycStatus: true,
      country: true,
      dob: true,
    },
  });
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const latest = await prisma.kycSubmission.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      provider: true,
      providerCaseId: true,
      providerStatus: true,
      amlStatus: true,
      riskLevel: true,
      riskScore: true,
      amlFlags: true,
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
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    status: user.kycStatus,
    profile: {
      country: user.country,
      dob: user.dob,
    },
    submission: latest,
  });
}
