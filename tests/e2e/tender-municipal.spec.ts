import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { signUpWithCompany } from "./helpers";

/**
 * Optional live packs in tests/fixtures/tenders/ (gitignored PDFs). CI skips
 * when the files are absent. Each test signs up a fresh company so the three
 * packs can run independently on the one trial credit.
 */
const TENDERS = join(import.meta.dirname, "../fixtures/tenders");
const STELLENBOSCH = join(TENDERS, "stellenbosch-bsm-126-26.pdf");
const CAPE_68Q = join(TENDERS, "cape-town-68q-2024-25.pdf");
const CAPE_107Q = join(TENDERS, "cape-town-107q-2024-25.pdf");

async function analyzePdf(page: Page, name: string, company: { cidb: string }, pdf: string) {
  await signUpWithCompany(page, name, {
    companyName: `${name} Pty Ltd`,
    cidb: company.cidb,
    bbbeeLevel: "1",
  });
  await page.goto("/analyze");
  await expect(page.getByTestId("analyze-title")).toBeVisible({ timeout: 10000 });
  await page.getByTestId("file-input").setInputFiles(pdf);
  await page.getByTestId("analyze-btn").click();
  await expect(page.getByTestId("results-section")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId("credits-balance")).toHaveText("0");
  const verdict = (await page.getByTestId("verdict-label").innerText()).trim();
  expect(["GO", "CAUTION", "NO-GO"]).toContain(verdict);
  return {
    title: await page.getByTestId("tender-title-value").innerText(),
    details: await page.getByTestId("tender-details-card").innerText(),
  };
}

test.describe("Municipal tender packs", () => {
  test("Stellenbosch B/SM 126/26 extracts CIDB, closing date, and scores", async ({ page }) => {
    test.skip(!existsSync(STELLENBOSCH), "stellenbosch-bsm-126-26.pdf is not present");
    test.setTimeout(240_000);
    const { title, details } = await analyzePdf(
      page,
      "Stellenbosch Tender",
      { cidb: "6GB" },
      STELLENBOSCH,
    );
    expect(title).toMatch(/stellenbosch|la colline|b\/?sm\s*126/i);
    expect(details).toMatch(/6\s*GB/i);
    expect(details).toMatch(/24\s+Aug\s+2026/);
    await expect(page.getByTestId("download-sbd4-btn")).toBeVisible();
    await expect(page.getByTestId("download-sbd61-btn")).toBeVisible();
  });

  test("Cape Town 68Q/2024/25 extracts CE grade and scores", async ({ page }) => {
    test.skip(!existsSync(CAPE_68Q), "cape-town-68q-2024-25.pdf is not present");
    test.setTimeout(240_000);
    const { title, details } = await analyzePdf(page, "Cape 68Q Tender", { cidb: "4CE" }, CAPE_68Q);
    expect(title).toMatch(/68Q|underground|hard surfacing|cape town/i);
    expect(details).toMatch(/1CE/i);
  });

  test("Cape Town 107Q/2024/25 extracts EB grade and scores", async ({ page }) => {
    test.skip(!existsSync(CAPE_107Q), "cape-town-107q-2024-25.pdf is not present");
    test.setTimeout(240_000);
    const { title, details } = await analyzePdf(
      page,
      "Cape 107Q Tender",
      { cidb: "4EB" },
      CAPE_107Q,
    );
    expect(title).toMatch(/107Q|electrical|cape town|waste/i);
    expect(details).toMatch(/[1-4]EB/i);
  });
});
