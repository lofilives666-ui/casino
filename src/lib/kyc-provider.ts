import crypto from "node:crypto";

export type KycProviderName = "mockkyc";

export type CreateKycCaseInput = {
  submissionId: string;
  userId: string;
  legalName: string;
  country: string;
};

export type CreateKycCaseResult = {
  provider: KycProviderName;
  providerCaseId: string;
  providerStatus: "submitted";
};

export type KycProviderWebhookEvent = {
  id: string;
  type:
    | "kyc.approved"
    | "kyc.rejected"
    | "kyc.needs_info"
    | "aml.clear"
    | "aml.review"
    | "aml.blocked";
  createdAt: string;
  data: {
    providerCaseId: string;
    note?: string;
    riskLevel?: "low" | "medium" | "high";
    riskScore?: number;
    flags?: string[];
  };
};

export async function createKycCase(input: CreateKycCaseInput): Promise<CreateKycCaseResult> {
  const seed = `${input.submissionId}:${input.userId}:${Date.now()}:${Math.random()}`;
  const providerCaseId = `kyc_${crypto.createHash("sha1").update(seed).digest("hex").slice(0, 16)}`;
  return {
    provider: "mockkyc",
    providerCaseId,
    providerStatus: "submitted",
  };
}

export function signKycWebhookPayload(payload: string) {
  const secret = process.env.KYC_WEBHOOK_SECRET?.trim();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyKycWebhookSignature(payload: string, signature: string | null) {
  const secret = process.env.KYC_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

