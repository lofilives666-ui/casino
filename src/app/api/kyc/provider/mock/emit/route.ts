import { NextResponse } from "next/server";
import { isAdminApiAuthorized } from "@/lib/admin-auth";
import { signKycWebhookPayload } from "@/lib/kyc-provider";

export const runtime = "nodejs";

type Payload = {
  providerCaseId?: string;
  type?: "kyc.approved" | "kyc.rejected" | "kyc.needs_info" | "aml.clear" | "aml.review" | "aml.blocked";
  note?: string;
  riskLevel?: "low" | "medium" | "high";
  riskScore?: number;
  flags?: string[];
};

function appBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export async function POST(request: Request) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json()) as Payload;
  if (!body.providerCaseId || !body.type) {
    return NextResponse.json({ message: "providerCaseId and type are required." }, { status: 400 });
  }

  const event = {
    id: `kyc_evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: body.type,
    createdAt: new Date().toISOString(),
    data: {
      providerCaseId: body.providerCaseId,
      note: body.note?.trim() || undefined,
      riskLevel: body.riskLevel,
      riskScore: body.riskScore,
      flags: body.flags,
    },
  };

  const raw = JSON.stringify(event);
  const signature = signKycWebhookPayload(raw);
  if (!signature) {
    return NextResponse.json({ message: "KYC_WEBHOOK_SECRET is not set." }, { status: 500 });
  }

  const webhookUrl = `${appBaseUrl()}/api/kyc/provider/webhook`;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kyc-signature": signature,
    },
    body: raw,
  });
  const data = await response.json();
  return NextResponse.json({ upstreamStatus: response.status, upstream: data, event });
}

