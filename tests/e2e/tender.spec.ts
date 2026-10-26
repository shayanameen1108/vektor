import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, signUpWithCompany } from "./helpers";
import { makePdf, pdfFixture } from "./fixtures";

test.describe("Tender Analysis Core", () => {
  test("upload → Workers AI → score/risk/verdict → returnables toggle → ownership isolation", async ({
    page,
  }) => {
    // Real Workers AI inference takes ~20-60s; the default 60s test timeout
    // does not cover signup + company setup + analysis.
    test.setTimeout(240_000);
    // Sign up User A. The Level 1 / 80-20 mapping is asserted on the score
    // cards below, and 4EB matches the tender fixture's CIDB token.
    await signUpWithCompany(page, "Tender User A", {
      companyName: "TenderCo A Pty Ltd",
      cidb: "4EB",
      bbbeeLevel: "1",
    });

    // Go to analyze
    await page.goto("/analyze");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("analyze-title")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("upload-card")).toBeVisible();
    await expect(page.getByTestId("select-pppfa-system")).toBeVisible();

    // Real PDF with CIDB token 4EB — extraction runs through unpdf in workerd.
    await page.getByTestId("file-input").setInputFiles(pdfFixture("tender-4eb.pdf"));
    await expect(page.getByTestId("selected-file-name")).toContainText("tender-4eb");

    await page.getByTestId("analyze-btn").click();
    await expect(page.getByTestId("results-section")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("credits-balance")).toHaveText("0");
    await expect(page.getByTestId("fit-score-card")).toBeVisible();
    await expect(page.getByTestId("gonogo-gauge")).toBeVisible();
    await expect(page.getByTestId("verdict-label")).toBeVisible();
    const verdictText = await page.getByTestId("verdict-label").innerText();
    expect(["GO", "CAUTION", "NO-GO"]).toContain(verdictText.trim());

    // B-BBEE points should be 20 for Level 1 with 80/20
    await expect(page.getByTestId("bbbee-points-value")).toContainText("20");
    // Fit score value
    await expect(page.getByTestId("fit-score-value")).toBeVisible();
    // Risk flags list should be present (at least bargaining or tax etc)
    // For this company we have no TAX/COIDA docs, so risk flags should be visible
    await expect(page.getByTestId("risk-flags-card")).toBeVisible();
    // Check that risk flags count is >0
    const riskCount = await page.getByTestId("risk-flags-count").innerText();
    expect(Number(riskCount.trim())).toBeGreaterThan(0);

    // Returnables checklist
    await expect(page.getByTestId("returnables-card")).toBeVisible();
    await expect(page.getByTestId("returnables-list")).toBeVisible();
    const firstToggle = page.locator('[data-testid^="returnable-toggle-"]').first();
    await expect(firstToggle).toBeVisible();
    const wasChecked = await firstToggle.isChecked();
    await firstToggle.click();
    // Wait for toggle to persist
    await expect(firstToggle).toBeChecked({ checked: !wasChecked, timeout: 5000 });
    // Toggle back
    await firstToggle.click();
    await expect(firstToggle).toBeChecked({ checked: wasChecked, timeout: 5000 });

    // Capture tender_id for isolation test
    const tenderId = await page.evaluate(async () => {
      // fetch tenders list for current company
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const companyId = comps[0]!.id;
      const res = await fetch(`/api/tenders/${companyId}`);
      const list = (await res.json()) as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });
    expect(tenderId).toBeTruthy();

    await page.goto("/app");
    await expect(page.getByTestId(`open-tender-${tenderId}`)).toBeVisible({ timeout: 15000 });
    await page.getByTestId(`open-tender-${tenderId}`).click();
    await expect(page.getByTestId("results-section")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("verdict-label")).toBeVisible();

    // Sign up User B and verify isolation
    // A second browser context is the only way to hold two sessions at once —
    // signing up in `page` would replace User A's session.
    const contextB = await page.context().browser()!.newContext();
    const pageB = await contextB.newPage();
    await signUpWithCompany(pageB, "Tender User B", {
      companyName: "TenderCo B Pty Ltd",
      cipc: "2022/654321/07",
    });

    // Try to fetch User A's tender as User B — should be 403
    const status = await pageB.evaluate(async (tid) => {
      const res = await fetch(`/api/tender/${tid}`);
      return res.status;
    }, tenderId as string);
    expect(status).toBe(403);

    // Also list with User A's companyId should be 403
    const companyAId = await page.evaluate(async () => {
      const res = await fetch("/api/companies");
      const list = (await res.json()) as Array<{ id: string; company_name: string }>;
      return list.find((c) => c.company_name.includes("TenderCo A"))?.id ?? null;
    });
    const listStatus = await pageB.evaluate(async (cid) => {
      const res = await fetch(`/api/tenders/${cid}`);
      return res.status;
    }, companyAId as string);
    expect(listStatus).toBe(403);

    await contextB.close();

    // Verify that uploading a non-PDF fails with appropriate error
    await page.goto("/analyze");
    await page.waitForLoadState("networkidle");
    const badBuffer = Buffer.from("not a pdf content");
    await page.getByTestId("file-input").setInputFiles({
      name: "tender.txt",
      mimeType: "text/plain",
      buffer: badBuffer,
    });
    await expect(page.getByText("Only PDF files are supported")).toBeVisible();
    await expect(page.getByTestId("file-input")).toHaveValue("");
    await expect(page.getByTestId("analyze-btn")).toBeDisabled();
  });

  test("analyze page has no accessibility violations", async ({ page }) => {
    await signUpWithCompany(page, "A11y Tender User", {
      companyName: "A11y TenderCo Pty Ltd",
      cipc: "2020/123456/07",
    });
    await page.goto("/analyze");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("analyze-title")).toBeVisible({ timeout: 10000 });
    await expectNoA11yViolations(page, "/analyze");
  });

  test("credit consumption refund on failure - invalid pdf handling", async ({ page }) => {
    // Covers a real Workers AI analysis, so allow headroom over the 60s default.
    test.setTimeout(240_000);
    await signUpWithCompany(page, "Credit User", { companyName: "CreditCo Pty Ltd" });

    const companyId = await page.evaluate(async () => {
      const companies = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
      return companies[0]!.id;
    });
    const balanceBefore = await page.evaluate(async (id) => {
      return ((await (await fetch(`/api/billing/credits/${id}`)).json()) as { credits: number })
        .credits;
    }, companyId);
    expect(balanceBefore).toBe(1);

    const blankPdf = await makePdf("blank.pdf", []);
    const failed = await page.request.post("/api/tenders/analyze", {
      multipart: {
        file: blankPdf,
        company_id: companyId,
        preference_system: "80/20",
      },
    });
    expect(failed.status()).toBe(400);
    expect(((await failed.json()) as { detail: string }).detail).toMatch(
      /credit has been refunded/i,
    );
    const balanceAfterFailure = await page.evaluate(async (id) => {
      return ((await (await fetch(`/api/billing/credits/${id}`)).json()) as { credits: number })
        .credits;
    }, companyId);
    expect(balanceAfterFailure).toBe(1);

    const success = await page.request.post("/api/tenders/analyze", {
      multipart: {
        file: pdfFixture("tender-4eb.pdf"),
        company_id: companyId,
        preference_system: "80/20",
      },
    });
    expect(success.status()).toBe(200);
    const analyzed = (await success.json()) as { tender_id: string };

    const download = await page.request.get(`/api/tenders/download/${analyzed.tender_id}`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("application/pdf");
    expect(download.headers()["content-disposition"]).toContain("attachment");
    expect((await download.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const range = await page.request.get(`/api/tenders/download/${analyzed.tender_id}`, {
      headers: { Range: "bytes=0-4" },
    });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-range"]).toMatch(/^bytes 0-4\/\d+$/);
    expect((await range.body()).toString()).toBe("%PDF-");
  });
});
