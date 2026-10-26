import { expect, type Page, test } from "@playwright/test";

import {
  clearSession,
  daysFromNow,
  expectNoA11yViolations,
  pickDate,
  signUpWithCompany,
} from "./helpers";
import { pdfFixture } from "./fixtures";

/**
 * Touch surfaces at 390x844. The desktop projects run these same routes at
 * desktop widths, which never exercise the off-canvas navigation, the mobile
 * top bar, or whether a control stays reachable inside a short viewport.
 */
const MOBILE = { width: 390, height: 844 };

/** No element may push the document wider than the viewport. */
async function expectFitsViewport(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `horizontal overflow (${scrollWidth}px > ${clientWidth}px)`,
  ).toBeLessThanOrEqual(clientWidth);
}

/** Everything the user taps must be inside the visible viewport. */
async function expectWithinViewport(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} has no box`).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE.width + 1);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(MOBILE.height + 1);
}

test.describe("mobile public", () => {
  test.use({ viewport: MOBILE });

  test("landing navigation is reachable through the mobile menu", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("landing-hero")).toBeVisible();

    // The inline nav is desktop-only; on a phone it lives behind the menu.
    await expect(page.getByTestId("landing-nav-about")).toBeHidden();
    await page.getByTestId("landing-mobile-menu").click();
    const sheet = page.getByTestId("landing-mobile-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("landing-nav-about-mobile").click();
    await expect(page).toHaveURL(/\/about$/);
  });

  test("public screens fit and pass axe at 390", async ({ page }) => {
    for (const path of ["/", "/about", "/terms", "/privacy", "/login", "/signup"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectFitsViewport(page);
      await expectNoA11yViolations(page, path);
    }
  });

  test("unauthenticated app routes redirect to login", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 15_000 });
  });

  test("404 exposes a real heading and offers a way home", async ({ page }) => {
    await clearSession(page);
    await page.goto("/not-a-real-vektor-route");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page, "the 404 page");
    await page.getByTestId("not-found-home").click();
    await expect(page.getByTestId("landing-hero")).toBeVisible();
  });
});

test.describe("mobile authed", () => {
  test.use({ viewport: MOBILE });

  test("off-canvas navigation reaches every primary section", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpWithCompany(page, "Mobile Nav Contractor", {
      companyName: "Mobile Nav Pty Ltd",
      cidb: "6CE",
    });

    await expect(page.getByTestId("mobile-topbar")).toBeVisible();
    await expect(page.getByTestId("dashboard-title")).toBeVisible();

    for (const [navTestId, marker] of [
      ["nav-documents", "vault-title"],
      ["nav-analyze", "analyze-title"],
      ["nav-billing", "billing-title"],
      ["nav-setup", "company-form-card"],
      ["nav-dashboard", "dashboard-title"],
    ] as const) {
      await page.getByTestId("mobile-menu-open").click();
      // The off-canvas drawer is a Sheet whose content the Sidebar component
      // tags data-mobile="true" (the same selector src/styles.css targets).
      const drawer = page.locator('[data-slot="sidebar"][data-mobile="true"]');
      await expect(drawer).toBeVisible();
      await drawer.getByTestId(navTestId).click();
      await expect(page.getByTestId(marker)).toBeVisible({ timeout: 15_000 });
      // Navigating must dismiss the drawer rather than leave it over the page.
      await expect(drawer).toBeHidden();
      await expectFitsViewport(page);
    }
  });

  test("dashboard call to action is tappable and on-screen", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpWithCompany(page, "Mobile Dash Contractor", {
      companyName: "Mobile Dash Pty Ltd",
      cidb: "3GB",
    });

    await expect(page.getByTestId("dashboard-stats-grid")).toBeVisible();
    await expectFitsViewport(page);
    // A long company name must not push the header CTA out of reach.
    await expectWithinViewport(page, "analyze-tender-btn");

    await page.getByTestId("analyze-tender-btn").click();
    await expect(page.getByTestId("analyze-title")).toBeVisible();
  });

  test("adding a compliance document works under touch", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpWithCompany(page, "Mobile Docs Contractor", {
      companyName: "Mobile Docs Pty Ltd",
      cidb: "4CE",
    });

    await page.goto("/documents");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Tax Clearance PIN/i }).click();
    await expect(page.getByTestId("link-sars-tcs-portal")).toBeVisible();

    // The date picker is the hardest control to use on a phone: the popover has
    // to open, take a selection and close without falling off the viewport.
    await pickDate(page, "input-expiry-date", daysFromNow(45));
    await expectFitsViewport(page);

    await page.getByTestId("input-file-upload").setInputFiles(pdfFixture("cert-tax-pin.pdf"));
    await expectWithinViewport(page, "add-document-btn");
    await page.getByTestId("add-document-btn").click();

    await expect(page.getByTestId(/^doc-row-/).first()).toBeVisible({ timeout: 20_000 });
  });

  test("edit dialog keeps its save control reachable", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpWithCompany(page, "Mobile Dialog Contractor", {
      companyName: "Mobile Dialog Pty Ltd",
      cidb: "2CE",
    });

    await page.goto("/documents");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Tax Clearance PIN/i }).click();
    await pickDate(page, "input-expiry-date", daysFromNow(60));
    await page.getByTestId("input-file-upload").setInputFiles(pdfFixture("cert-tax-pin.pdf"));
    await page.getByTestId("add-document-btn").click();
    await expect(page.getByTestId(/^doc-row-/).first()).toBeVisible({ timeout: 20_000 });
    const row = page.locator('[data-testid^="doc-row-"]').first();
    // Park the row mid-viewport: automatic scrolling leaves it under the sticky
    // table header, whose cells then swallow the click.
    await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await row.locator('[data-testid^="edit-doc-"]').first().click();
    const dialog = page.getByTestId("edit-doc-dialog");
    await expect(dialog).toBeVisible();
    await expectWithinViewport(page, "edit-doc-save");
    await expectNoA11yViolations(page, "the open edit dialog");
    await page.getByTestId("edit-doc-cancel").click();
    await expect(dialog).toBeHidden();
  });

  test("authed screens pass axe at 390", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpWithCompany(page, "Mobile A11y Contractor", {
      companyName: "Mobile A11y Pty Ltd",
      cidb: "5CE",
    });

    for (const [path, marker] of [
      ["/app", "dashboard-title"],
      ["/documents", "vault-title"],
      ["/analyze", "analyze-title"],
      ["/billing", "billing-title"],
      ["/help", "help-header-authed"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByTestId(marker)).toBeVisible({ timeout: 15_000 });
      await expectNoA11yViolations(page, path);
    }
  });
});
