import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type StartPayload = {
  legalName?: string;
  dob?: string;
  country?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
};

export async function POST(request: Request) {
  const session = verifySessionToken((await cookies()).get(getSessionCookieName())?.value);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const limiter = checkRateLimit({
    key: `kyc:start:${session.userId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { message: `Too many KYC updates. Retry in ${limiter.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  const body = (await request.json()) as StartPayload;
  const legalName = body.legalName?.trim() ?? "";
  const country = body.country?.trim() ?? "";
  const addressLine1 = body.addressLine1?.trim() ?? "";
  const city = body.city?.trim() ?? "";
  const postalCode = body.postalCode?.trim() ?? "";
  const dob = body.dob ? new Date(body.dob) : null;

  if (!legalName || !country || !addressLine1 || !city || !postalCode || !dob || Number.isNaN(dob.getTime())) {
    return NextResponse.json({ message: "All basic KYC fields are required." }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const submission = await tx.kycSubmission.create({
      data: {
        userId: session.userId,
        status: "basic_submitted",
        legalName,
        dob,
        country,
        addressLine1,
        city,
        postalCode,
      },
    });

    await tx.user.update({
      where: { id: session.userId },
      data: {
        country,
        dob,
        kycStatus: "basic_submitted",
      },
    });

    return submission;
  });

  return NextResponse.json({
    message: "Basic KYC details saved.",
    submissionId: created.id,
  });
}
