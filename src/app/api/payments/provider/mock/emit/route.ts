import { NextResponse } from "next/server";
import { isAdminApiAuthorized } from "@/lib/admin-auth";
import { signWebhookPayload } from "@/lib/payment-provider";

export const runtime = "nodejs";

type Payload = {
  providerRef?: string;
  type?: "deposit.succeeded" | "deposit.failed" | "withdrawal.succeeded" | "withdrawal.failed";
  reason?: string;
};

function appBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export async function POST(request: Request) {
  if (!isAdminApiAuthorized(request.headers)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const body = (await request.json()) as Payload;
  if (!body.providerRef || !body.type) {
    return NextResponse.json({ message: "providerRef and type are required." }, { status: 400 });
  }

  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: body.type,
    createdAt: new Date().toISOString(),
    data: {
      providerRef: body.providerRef,
      reason: body.reason?.trim() || undefined,
    },
  };

  const raw = JSON.stringify(event);
  const signature = signWebhookPayload(raw);
  if (!signature) {
    return NextResponse.json({ message: "PAYMENT_WEBHOOK_SECRET is not set." }, { status: 500 });
  }

  const webhookUrl = `${appBaseUrl()}/api/payments/provider/webhook`;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-payment-signature": signature,
    },
    body: raw,
  });
  const data = await response.json();
  return NextResponse.json({ upstreamStatus: response.status, upstream: data, event });
}

