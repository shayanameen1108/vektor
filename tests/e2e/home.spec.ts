import { expect, test } from "@playwright/test";
import {
  TEST_PASSWORD,
  clearSession,
  ensureCompanySetup,
  expectNoA11yViolations,
  signUp,
} from "./helpers";

test("landing page renders the marketing home", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveTitle("Vektor — SA Tender Compliance");
  await expect(page.getByTestId("landing-hero")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Never lose a bid/ })).toBeVisible();
});

test("landing mobile sheet links are anchors, not fake buttons", async ({ page }) => {
  const buttonRoleWarnings: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.includes("expected a native `<button>`") ||
      text.includes("expected a native <button>")
    ) {
      buttonRoleWarnings.push(text);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("landing-mobile-menu").click();
  await expect(page.getByTestId("landing-mobile-sheet")).toBeVisible();

  for (const testId of [
    "landing-nav-about-mobile",
    "landing-signin-mobile",
    "landing-cta-mobile",
  ]) {
    const link = page.getByTestId(testId);
    await expect(link).toBeVisible();
    expect(await link.evaluate((el) => el.tagName)).toBe("A");
  }

  expect(buttonRoleWarnings).toEqual([]);
});

test("home page has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expectNoA11yViolations(page, "/");
});

test("auth pages have no accessibility violations", async ({ page }) => {
  for (const path of [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password?token=e2e-a11y-probe",
  ]) {
    await page.goto(path);
    await expect(page.locator("form").first()).toBeVisible({ timeout: 15000 });
    await expectNoA11yViolations(page, path);
  }
});

test("forgot password form confirms the reset link was requested", async ({ page }) => {
  const email = await signUp(page, "Reset Journey");

  await clearSession(page);
  await page.goto("/forgot-password");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("submit-forgot").click();
  await expect(page.getByTestId("forgot-sent-state")).toBeVisible({ timeout: 15000 });
  // Delivery itself goes through Resend and is not observable black-box;
  // the sent-state above proves the request path works end to end.
});

test("login returns a user to the protected deep link", async ({ page }) => {
  const email = await signUp(page, "Deep Link User");

  await clearSession(page);
  await page.goto("/documents");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdocuments/, { timeout: 15000 });
  // Explicit login: the point of this test is the `?redirect=` target, so the
  // landing assertion stays here rather than in the shared login() helper.
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("submit-login").click();

  await expect(page).toHaveURL(/\/documents$/, { timeout: 15000 });
  await expect(page.getByTestId("nav-documents")).toHaveAttribute("aria-current", "page");
});

test("setup page has no accessibility violations", async ({ page }) => {
  // Fresh signup lands on /setup with no company yet — the guarded route state
  await signUp(page, "A11y Setup");
  await ensureCompanySetup(page);
  await page.getByTestId("bc-multiselect-trigger").click();
  await expect(page.getByTestId("bc-multiselect-option-BCCEI")).toBeVisible();
  await page.getByTestId("bc-multiselect-option-BCCEI").click();
  await expect(page.getByTestId("bc-chip-BCCEI")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("bc-multiselect-content")).toHaveCount(0);

  await expectNoA11yViolations(page, "/setup with councils selected");
});
