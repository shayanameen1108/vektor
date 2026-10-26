import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Shared password — every spec signs up with the same strong passphrase. */
export const TEST_PASSWORD = "correct-horse-battery-staple-123";

/**
 * Recipient Resend's test-mode keys accept. Live keys deliver to anything,
 * but `re_test_…` keys reject ordinary domains (including @example.com) with
 * 422. Only a remote preview sends through Resend; local runs keep mail in the
 * in-memory mailbox.
 */
export const RESEND_TEST_INBOX = "delivered@resend.dev";

/** Unique per-test email — Date.now() + random suffix avoids cross-worker collisions. */
export function uniqueEmail(prefix = "vektor"): string {
  // `signUp()` derives the prefix from a display name, so fold anything that is
  // not email-safe (spaces, capitals, punctuation) into a `-` separated slug.
  const slug =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vektor";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug}.${Date.now()}.${rand}@example.com`;
}

/** Days from today as YYYY-MM-DD, for expiry dates that must land on a reminder threshold. */
export function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Wait until React has hydrated a server-rendered element: React tags each
 * hydrated DOM node with `__reactProps$…`. Typing into a form before then
 * leaves React's state empty, so the submit handler sees blank fields — on a
 * slow CI runner the fills can land inside that window.
 */
export async function waitForHydration(page: Page, testId: string): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      return (
        element !== null && Object.keys(element).some((key) => key.startsWith("__reactProps$"))
      );
    },
    testId,
    { timeout: 20000 },
  );
}

/**
 * Sign up through the UI and wait until the authenticated chrome confirms the
 * session, so no later step races the post-signup redirect.
 */
export async function signUp(
  page: Page,
  name: string,
  opts: { email?: string; ref?: string } = {},
): Promise<string> {
  const email = opts.email ?? uniqueEmail(name);
  await page.goto(opts.ref ? `/signup?ref=${opts.ref}` : "/signup");
  await expect(page.getByTestId("signup-form")).toBeVisible({ timeout: 20000 });
  await waitForHydration(page, "signup-form");
  if (opts.ref) {
    await expect(page.getByTestId("signup-referral-banner")).toBeVisible();
  }
  await page.getByTestId("input-name").fill(name);
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("submit-signup").click();
  // Signup lands on /setup. Sidebar email is not in the DOM below `md` (the
  // rail is off-canvas), so also accept the setup form itself.
  // .first() keeps this out of strict mode when more than one match is present.
  await expect(
    page
      .getByTestId("user-email")
      .or(page.getByTestId("company-form-card"))
      .or(page.getByTestId("dashboard-title"))
      .first(),
  ).toBeVisible({ timeout: 20000 });
  return email;
}

/**
 * Create the active company through the setup form and wait for the dashboard
 * it redirects to. Reaching the dashboard is itself the proof that the create
 * succeeded — a rejected submit leaves the user on /setup.
 */
export async function createCompany(
  page: Page,
  data: {
    name: string;
    contactEmail: string;
    cipc?: string;
    cidb?: string;
    bbbeeLevel?: string;
  },
): Promise<void> {
  await ensureCompanySetup(page);
  await page.getByTestId("input-company-name").fill(data.name);
  await page.getByTestId("input-cipc-num").fill(data.cipc ?? "2021/123456/07");
  await page.getByTestId("input-contact-email").fill(data.contactEmail);
  if (data.cidb) {
    await page.getByTestId("input-cidb-grade").fill(data.cidb);
  }
  if (data.bbbeeLevel) {
    await page.getByTestId("select-bbbee-level").click();
    await page.getByRole("option", { name: new RegExp(`Level ${data.bbbeeLevel}\\b`) }).click();
  }
  await page.getByTestId("submit-company-btn").click();
  await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 20000 });
}

/** Log in and wait for the destination's chrome to settle before the next navigation. */
export async function login(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await clearSession(page);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 10000 });
  await waitForHydration(page, "login-form");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("submit-login").click();
  // Assert the destination chrome rather than the URL: a `?redirect=/app`
  // query string would satisfy a URL match before navigation has happened.
  await expect(page.getByTestId("admin-nav").or(page.getByTestId("dashboard-title"))).toBeVisible({
    timeout: 20000,
  });
  await page.waitForLoadState("networkidle");
}

/**
 * Ensure the company setup form is on screen for the current session.
 *
 * Right after signup the router may still be navigating to `/setup`, so an
 * immediate `page.goto("/setup")` can be interrupted. This waits until routing
 * has settled on the setup form or the dashboard, and only then navigates.
 */
export async function ensureCompanySetup(page: Page): Promise<void> {
  await expect(
    page.getByTestId("dashboard-title").or(page.getByTestId("company-form-card")),
  ).toBeVisible({ timeout: 20000 });
  if (!page.url().includes("/setup")) {
    await page.goto("/setup");
    await page.waitForLoadState("networkidle");
  }
  await expect(page.getByTestId("company-form-card")).toBeVisible({ timeout: 15000 });
}

/** Open the EFT dialog (already clicked) and mint a VEK reference. */
export async function generateEftReference(page: Page): Promise<void> {
  const dialog = page.getByTestId("eft-payment-dialog");
  await expect(dialog).toBeVisible({ timeout: 15000 });
  // The dialog mounts while the balance and package queries are still landing,
  // and those results re-render it, detaching the button mid-click.
  await page.waitForLoadState("networkidle");
  await dialog.getByTestId("eft-generate-reference").click();
  await expect(page.getByTestId("eft-creating")).toBeHidden({ timeout: 15000 });
  await expect(page.getByTestId("eft-instructions")).toBeVisible();
}

export interface EftBankDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  branch_code: string;
  account_type: string;
}

/**
 * The bank details the Worker is actually serving, read from the same endpoint
 * the dialog renders. Specs assert against this instead of literals copied out
 * of `.env`, which only exist on a developer's machine.
 */
export async function eftBankDetails(page: Page): Promise<EftBankDetails> {
  const res = await page.request.get("/api/eft/bank-details");
  expect(res.ok()).toBe(true);
  return (await res.json()) as EftBankDetails;
}

/**
 * `src/lib/eft.ts` blanks `bank_name`/`branch_code` when the env var is unset,
 * and an assertion against `""` always passes. Specs that check the rendered
 * values call this first so an unconfigured environment fails loudly.
 */
export function isEftConfigured(details: EftBankDetails): boolean {
  return Boolean(details.account_number && details.account_holder);
}

/**
 * Clear all session state (cookies + web storage) and unload the app.
 *
 * The still-mounted SPA keeps better-auth's last session in memory; after
 * `clearCookies()` its guards react to the next poll and race whatever full
 * page load comes next. Unloading to about:blank first makes the subsequent
 * navigation deterministic.
 */
export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.goto("about:blank");
}

/**
 * Assert the current page has zero axe violations.
 *
 * Every spec previously rolled its own wait, and the ones that only waited for
 * an element to be *visible* could measure the page before `styles.css` had
 * applied. axe then reported the browser's own defaults as contrast failures
 * the product does not have.
 * Waiting on a resolved design token proves the stylesheet is in the cascade.
 */
export async function expectNoA11yViolations(page: Page, scope: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    if (!primary) return false;
    return getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)";
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `a11y violations on ${scope}`).toEqual([]);
}
