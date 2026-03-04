import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signKycWebhookPayload, verifyKycWebhookSignature } from "@/lib/kyc-provider";

describe("kyc webhook signing", () => {
  const ORIGINAL_SECRET = process.env.KYC_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.KYC_WEBHOOK_SECRET = "webhook-unit-test-secret";
  });

  afterEach(() => {
    process.env.KYC_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it("verifies a valid signature", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "kyc.approved" });
    const signature = signKycWebhookPayload(payload);

    expect(signature).toBeTruthy();
    expect(verifyKycWebhookSignature(payload, signature)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const payload = JSON.stringify({ id: "evt_2", type: "aml.blocked" });

    expect(verifyKycWebhookSignature(payload, "not-a-valid-signature")).toBe(false);
  });
});
