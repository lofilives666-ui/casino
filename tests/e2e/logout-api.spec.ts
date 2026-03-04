import { expect, test } from "@playwright/test";
import { createSessionToken, getSessionCookieName } from "../../src/lib/session";

test("logout API replays response for same idempotency key", async ({ context, page, baseURL }) => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";
  const appUrl = baseURL ?? "http://127.0.0.1:3000";
  const cookieDomain = new URL(appUrl).hostname;
  const sessionToken = createSessionToken({
    userId: "e2e-user-2",
    fullName: "Replay Tester",
    email: "replay@example.com",
  });

  await context.addCookies([
    {
      name: getSessionCookieName(),
      value: sessionToken,
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfPayload = (await csrfResponse.json()) as { token?: string };
  expect(csrfPayload.token).toBeTruthy();

  const idemKey = `logout-e2e-${Date.now()}`;
  const headers = {
    "x-csrf-token": csrfPayload.token ?? "",
    "x-idempotency-key": idemKey,
  };

  const first = await page.request.post("/api/auth/logout", { headers });
  expect(first.status()).toBe(200);
  const firstJson = (await first.json()) as { message?: string };
  expect(firstJson.message).toBe("Logged out.");
  expect(first.headers()["x-idempotent-replayed"]).toBeUndefined();

  const second = await page.request.post("/api/auth/logout", { headers });
  expect(second.status()).toBe(200);
  const secondJson = (await second.json()) as { message?: string };
  expect(secondJson.message).toBe("Logged out.");
  expect(second.headers()["x-idempotent-replayed"]).toBe("1");
});
