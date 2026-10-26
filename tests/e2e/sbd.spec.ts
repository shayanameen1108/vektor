import { expect, test } from "@playwright/test";
import {
  createCompany,
  ensureCompanySetup,
  expectNoA11yViolations,
  signUp,
  signUpWithCompany,
} from "./helpers";
import { pdfFixture } from "./fixtures";

test.describe("SBD PDF generation", () => {
  test("SBD 4 and 6.1 downloads succeed and UI exposes them, respects tender ownership", async ({
    page,
  }) => {
    // Real Workers AI inference takes ~20-60s; the default 60s test timeout
    // does not cover signup + company setup + analysis.
    test.setTimeout(240_000);
    const browser = page.context().browser()!;

    // User A signup. The authorised-signatory fields are the one part of the
    // setup form the shared helper does not cover, so they go on the form
    // before createCompany() submits it (ensureCompanySetup is already
    // satisfied there, so it does not navigate and wipe them).
    const emailA = await signUp(page, "SBD User A");
    await ensureCompanySetup(page);
    const signatoryName = page.getByTestId("input-authorised-signatory-name");
    const signatoryPosition = page.getByTestId("input-authorised-signatory-position");
    await expect(signatoryName).toBeVisible();
    await expect(signatoryPosition).toBeVisible();
    await signatoryName.fill("Jane Doe");
    await signatoryPosition.fill("Director");
    await createCompany(page, {
      name: "SBD Co A Pty Ltd",
      contactEmail: emailA,
      cidb: "4EB",
      bbbeeLevel: "1",
    });

    // Analyze tender
    await page.goto("/analyze");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("analyze-title")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("upload-card")).toBeVisible();

    await page.getByTestId("file-input").setInputFiles(pdfFixture("tender-4eb.pdf"));
    await expect(page.getByTestId("selected-file-name")).toContainText("tender-4eb");
    await page.getByTestId("analyze-btn").click();
    await expect(page.getByTestId("results-section")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("fit-score-card")).toBeVisible();

    // UI exposes both SBD download buttons (ephemeral result)
    await expect(page.getByTestId("download-sbd4-btn")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("download-sbd61-btn")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("sbd-downloads")).toBeVisible();
    await expect(page.getByTestId("download-sbd4-btn")).toContainText("SBD 4");
    await expect(page.getByTestId("download-sbd61-btn")).toContainText("SBD 6.1");

    // Persistent per-tender SBD actions — "for any analyzed tender" (survives navigation)
    await expect(page.getByTestId("tender-list-section")).toBeVisible({ timeout: 10000 });
    // Tender list will populate; poll until we can resolve tenderId below

    // Capture tenderId for API verification
    const tenderId = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const companyId = comps[0]!.id;
      const res = await fetch(`/api/tenders/${companyId}`);
      const list = (await res.json()) as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });
    expect(tenderId).toBeTruthy();
    // Persistent per-tender actions in Recent Tenders list
    await expect(page.getByTestId(`sbd4-btn-${tenderId}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`sbd61-btn-${tenderId}`)).toBeVisible({ timeout: 10000 });

    // Verify SBD4 download via direct API fetch (no R2 persistence required, ownership respected)
    const sbd4Status = await page.evaluate(async (tid) => {
      const res = await fetch(`/api/tender/${tid}/sbd4`);
      const ct = res.headers.get("content-type");
      const cd = res.headers.get("content-disposition");
      const buf = await res.arrayBuffer();
      const header = new TextDecoder().decode(new Uint8Array(buf).slice(0, 5));
      return { status: res.status, ct, cd, header, len: buf.byteLength };
    }, tenderId as string);
    expect(sbd4Status.status).toBe(200);
    expect(sbd4Status.ct).toContain("application/pdf");
    expect(sbd4Status.cd).toContain(`SBD4-${tenderId}`);
    expect(sbd4Status.header).toBe("%PDF-");
    expect(sbd4Status.len).toBeGreaterThan(1000);

    const sbd61Status = await page.evaluate(async (tid) => {
      const res = await fetch(`/api/tender/${tid}/sbd61`);
      const ct = res.headers.get("content-type");
      const cd = res.headers.get("content-disposition");
      const buf = await res.arrayBuffer();
      const header = new TextDecoder().decode(new Uint8Array(buf).slice(0, 5));
      return { status: res.status, ct, cd, header, len: buf.byteLength };
    }, tenderId as string);
    expect(sbd61Status.status).toBe(200);
    expect(sbd61Status.ct).toContain("application/pdf");
    expect(sbd61Status.cd).toContain(`SBD61-${tenderId}`);
    expect(sbd61Status.header).toBe("%PDF-");
    expect(sbd61Status.len).toBeGreaterThan(1000);

    // The analyzed tender also exposes persistent per-tender SBD actions.
    await expect(page.getByTestId(`sbd4-btn-${tenderId}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`sbd61-btn-${tenderId}`)).toBeVisible({ timeout: 10000 });

    // The trial grant is exactly one credit — a second analysis is refused and
    // the credit ledger stays consistent (see tender.spec for the same rule).

    // Ownership isolation: User B cannot download User A's tender SBDs
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUpWithCompany(pageB, "SBD User B", {
      companyName: "SBD Co B Pty Ltd",
      cipc: "2022/654321/07",
    });

    const forbidden4 = await pageB.evaluate(async (tid) => {
      const res = await fetch(`/api/tender/${tid}/sbd4`);
      return res.status;
    }, tenderId as string);
    expect(forbidden4).toBe(403);

    const forbidden61 = await pageB.evaluate(async (tid) => {
      const res = await fetch(`/api/tender/${tid}/sbd61`);
      return res.status;
    }, tenderId as string);
    expect(forbidden61).toBe(403);

    await contextB.close();

    // Unauthenticated should be 401
    const ctxAnon = await browser.newContext();
    const anonPage = await ctxAnon.newPage();
    await anonPage.goto("/");
    await anonPage.waitForLoadState("networkidle");
    const unauth = await anonPage.evaluate(async (tid) => {
      const res = await fetch(`/api/tender/${tid}/sbd4`);
      return res.status;
    }, tenderId as string);
    expect(unauth).toBe(401);
    await ctxAnon.close();
  });

  test("dashboard SBD actions stay in the 390 viewport without horizontal scroll", async ({
    page,
  }) => {
    // Real Workers AI inference — allow headroom over the 60s default.
    test.setTimeout(240_000);
    await signUpWithCompany(page, "SBD Mobile User", {
      companyName: "SBD Mobile Co Pty Ltd",
      cipc: "2020/123456/07",
    });

    await page.goto("/analyze");
    await expect(page.getByTestId("analyze-title")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("file-input").setInputFiles(pdfFixture("tender-4eb.pdf"));
    await page.getByTestId("analyze-btn").click();
    await expect(page.getByTestId("results-section")).toBeVisible({ timeout: 120_000 });

    const tenderId = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const companyId = comps[0]!.id;
      const res = await fetch(`/api/tenders/${companyId}`);
      const list = (await res.json()) as Array<{ id: string }>;
      return list[0]?.id ?? null;
    });
    expect(tenderId).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");
    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("recent-tenders-card").scrollIntoViewIfNeeded();
    await expect(page.getByTestId(`sbd4-btn-${tenderId}`)).toBeInViewport();
    await expect(page.getByTestId(`sbd61-btn-${tenderId}`)).toBeInViewport();
  });

  test("analyze page with SBD downloads has no accessibility violations", async ({ page }) => {
    // Real Workers AI inference — allow headroom over the 60s default.
    test.setTimeout(240_000);
    await signUpWithCompany(page, "SBD A11y User", {
      companyName: "SBD A11y Co Pty Ltd",
      cipc: "2020/123456/07",
    });

    await page.goto("/analyze");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("analyze-title")).toBeVisible({ timeout: 10000 });

    // Upload and analyze to expose SBD buttons for a11y check
    await page.getByTestId("file-input").setInputFiles(pdfFixture("tender-4eb.pdf"));
    await page.getByTestId("analyze-btn").click();
    await expect(page.getByTestId("results-section")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("download-sbd4-btn")).toBeVisible();
    await expect(page.getByTestId("download-sbd61-btn")).toBeVisible();
    await expect(page.getByText("Tender analyzed successfully!")).toBeHidden({ timeout: 8000 });

    await expectNoA11yViolations(page, "the tender analysis result");
  });

  test("404 for non-existent tender SBD", async ({ page }) => {
    await signUp(page, "404 User");

    const fakeId = "00000000-0000-4000-a000-000000000000";
    const s1 = await page.evaluate(async (id) => {
      const r = await fetch(`/api/tender/${id}/sbd4`);
      return r.status;
    }, fakeId);
    expect(s1).toBe(404);
    const s2 = await page.evaluate(async (id) => {
      const r = await fetch(`/api/tender/${id}/sbd61`);
      return r.status;
    }, fakeId);
    expect(s2).toBe(404);
  });
});
