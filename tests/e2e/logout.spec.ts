import { expect, test } from "@playwright/test";
import { createSessionToken, getSessionCookieName } from "../../src/lib/session";

test("authenticated user can logout from home sidebar", async ({ context, page, baseURL }) => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";
  const appUrl = baseURL ?? "http://127.0.0.1:3000";
  const cookieDomain = new URL(appUrl).hostname;
  const sessionToken = createSessionToken({
    userId: "e2e-user-1",
    fullName: "E2E Tester",
    email: "e2e@example.com",
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

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("link", { name: "Login" }).first()).toBeVisible();
});
