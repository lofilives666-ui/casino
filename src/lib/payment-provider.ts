import crypto from "node:crypto";

export type PaymentProviderName = "mockpay";

export type CreateDepositSessionInput = {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
};

export type CreateDepositSessionResult = {
  provider: PaymentProviderName;
  providerRef: string;
  checkoutUrl: string;
  expiresAt: string;
};

export type ProviderWebhookEvent = {
  id: string;
  type: "deposit.succeeded" | "deposit.failed" | "withdrawal.succeeded" | "withdrawal.failed";
  createdAt: string;
  data: {
    providerRef: string;
    reason?: string;
  };
};

function createProviderRef(prefix: "dep" | "wd") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function getBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export async function createDepositSession(input: CreateDepositSessionInput): Promise<CreateDepositSessionResult> {
  const providerRef = createProviderRef("dep");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const checkoutUrl = `${getBaseUrl()}/wallet?depositRef=${providerRef}&tx=${input.transactionId}`;

  return {
    provider: "mockpay",
    providerRef,
    checkoutUrl,
    expiresAt,
  };
}

export function signWebhookPayload(payload: string) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
