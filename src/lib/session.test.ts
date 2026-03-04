import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, getSessionTtlSeconds, verifySessionToken } from "@/lib/session";

describe("session token", () => {
  const ORIGINAL_SECRET = process.env.SESSION_SECRET;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T00:00:00.000Z"));
    process.env.SESSION_SECRET = "unit-test-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
  });

  it("creates and verifies a valid token", () => {
    const token = createSessionToken({
      userId: "user_123",
      fullName: "Test User",
      email: "test@example.com",
    });

    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("user_123");
    expect(payload?.email).toBe("test@example.com");
  });

  it("rejects tampered tokens", () => {
    const token = createSessionToken({
      userId: "user_123",
      fullName: "Test User",
      email: "test@example.com",
    });
    const tampered = `${token}extra`;

    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken({
      userId: "user_123",
      fullName: "Test User",
      email: "test@example.com",
    });
    vi.advanceTimersByTime((getSessionTtlSeconds() + 1) * 1000);

    expect(verifySessionToken(token)).toBeNull();
  });
});
