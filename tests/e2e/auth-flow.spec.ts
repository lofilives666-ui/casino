import { expect, test } from "@playwright/test";

test("signup -> login -> email verification flow", async ({ page }) => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const email = `e2e.user.${nonce}@example.com`;
  const password = "TestPass123!";
  const fullName = "E2E Full Flow";

  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(fullName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Login Password").fill(password);
  await page.getByRole("button", { name: "User Agreement" }).click();
  await expect(page.getByRole("heading", { name: "User Agreement" })).toBeVisible();
  const agreementBox = page.getByTestId("agreement-scroll-box");
  await agreementBox.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page.getByText("Account created. Redirecting to login...")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Login successful. Redirecting to home...")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Email Verification" })).toBeVisible();

  await page.getByRole("button", { name: "Send Code" }).click();
  const devCodeLabel = page.getByText(/Dev code:\s*\d{6}/);
  await expect(devCodeLabel).toBeVisible();

  const devCodeText = (await devCodeLabel.innerText()).trim();
  const codeMatch = devCodeText.match(/(\d{6})/);
  expect(codeMatch).not.toBeNull();
  const otpCode = codeMatch?.[1] ?? "";

  await page.getByPlaceholder("Enter 6-digit code").fill(otpCode);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Email verification completed.")).toBeVisible();
});
