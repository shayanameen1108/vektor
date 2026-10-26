import { expect, test } from "@playwright/test";

import { expectNoA11yViolations, signUpWithCompany } from "./helpers";

/**
 * Company profile *edit* (PATCH /api/companies/$companyId). Every other spec
 * only ever creates a company through /setup, so the update path — including
 * whether the form re-seeds from the stored record — was unexercised.
 */
test.describe("Company profile edit", () => {
  test("re-seeds, updates and persists statutory details", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpWithCompany(page, "Profile Editor", {
      companyName: "Original Name Pty Ltd",
      cipc: "2021/123456/07",
      cidb: "3CE",
      bbbeeLevel: "1",
    });

    await page.goto("/setup");
    await expect(page.getByTestId("company-form-card")).toBeVisible({ timeout: 15_000 });

    // Edit mode, not first-run setup.
    await expect(page.getByRole("heading", { level: 1, name: "Company Profile" })).toBeVisible();
    await expect(page.getByTestId("input-company-name")).toHaveValue("Original Name Pty Ltd");
    await expect(page.getByTestId("input-cipc-num")).toHaveValue("2021/123456/07");
    await expect(page.getByTestId("input-cidb-grade")).toHaveValue("3CE");

    await page.getByTestId("input-company-name").fill("Renamed Contractor Pty Ltd");
    await page.getByTestId("input-cidb-grade").fill("6GB");
    await page.getByTestId("select-bbbee-level").click();
    await page.getByRole("option", { name: /Level 2\b/ }).click();
    await page.getByTestId("submit-company-btn").click();

    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Company profile updated", { timeout: 15_000 });

    // Reload from the database: an optimistic cache update alone would not
    // survive this.
    await page.goto("/setup");
    await expect(page.getByTestId("company-form-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("input-company-name")).toHaveValue("Renamed Contractor Pty Ltd");
    await expect(page.getByTestId("input-cidb-grade")).toHaveValue("6GB");

    // The dashboard header reads the same record.
    await page.goto("/app");
    await expect(page.getByTestId("dashboard-title")).toHaveText("Renamed Contractor Pty Ltd", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("cidb-display")).toContainText("6GB");
  });

  test("rejects a malformed CIPC number instead of saving", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpWithCompany(page, "Bad CIPC Editor", {
      companyName: "Valid Cipc Pty Ltd",
      cipc: "2020/111111/07",
    });

    await page.goto("/setup");
    await expect(page.getByTestId("company-form-card")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("input-cipc-num").fill("not-a-cipc-number");

    // A malformed statutory number blocks the submit control outright, so it
    // cannot be persisted even by a determined click.
    await expect(page.getByTestId("submit-company-btn")).toBeDisabled();
    await expect(page.getByTestId("input-cipc-num")).toHaveValue("not-a-cipc-number");

    await page.getByTestId("input-cipc-num").fill("2020/222222/07");
    await expect(page.getByTestId("submit-company-btn")).toBeEnabled();
    await page.getByTestId("submit-company-btn").click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText(
      "Company profile updated",
      { timeout: 15_000 },
    );
  });

  test("the edit form has no accessibility violations", async ({ page }) => {
    test.setTimeout(150_000);
    await signUpWithCompany(page, "A11y Editor", { companyName: "A11y Edit Pty Ltd", cidb: "4CE" });

    await page.goto("/setup");
    await expect(page.getByTestId("company-form-card")).toBeVisible({ timeout: 15_000 });
    await expectNoA11yViolations(page, "/setup (edit mode)");
  });
});
