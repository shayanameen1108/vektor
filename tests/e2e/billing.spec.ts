import { expect, test } from "@playwright/test";
import {
  eftBankDetails,
  expectNoA11yViolations,
  generateEftReference,
  isEftConfigured,
  signUp,
  signUpWithCompany,
} from "./helpers";

test.describe("EFT Billing", () => {
  test("catalog display → request → bank details → proof upload → status pending_review → my-requests → cancellation", async ({
    page,
  }) => {
    await signUpWithCompany(page, "Billing E2E User", {
      companyName: "Billing E2E Pty Ltd",
      cidb: "4GB",
      bbbeeLevel: "1",
    });

    // Go to billing
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-title")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("current-balance-card")).toBeVisible();
    await expect(page.getByTestId("my-eft-payments-section")).toBeVisible();
    await expect(page.getByTestId("my-eft-empty")).toBeVisible();
    // Catalog checks
    await expect(page.getByTestId("package-tc_starter_monthly_v2")).toBeVisible();
    await expect(page.getByTestId("package-tc_pro_monthly_v2")).toBeVisible();
    await expect(page.getByTestId("package-tc_scale_monthly_v2")).toBeVisible();
    await expect(page.getByTestId("package-tc_credits_1_v2")).toBeVisible();
    // popular tag on Pro
    await expect(page.getByTestId("popular-badge-tc_pro_monthly_v2")).toBeVisible();
    await expect(page.getByTestId("popular-badge-tc_pro_monthly_v2")).toContainText("Popular");
    // Subscription grid should show R399, R1299, R2499, R149
    await expect(page.getByTestId("package-tc_starter_monthly_v2")).toContainText("R399,00");
    await expect(page.getByTestId("package-tc_pro_monthly_v2")).toContainText("R1 299,00");
    await expect(page.getByTestId("package-tc_scale_monthly_v2")).toContainText("R2 499,00");
    await expect(page.getByTestId("package-tc_credits_1_v2")).toContainText("R149,00");
    // No Stripe mention
    await expect(page.locator("body")).not.toContainText("Stripe");
    // Pay by EFT buttons exist
    await expect(page.getByTestId("subscribe-tc_starter_monthly_v2")).toBeVisible();
    await expect(page.getByTestId("subscribe-tc_pro_monthly_v2")).toBeVisible();
    await expect(page.getByTestId("buy-tc_credits_1_v2")).toBeVisible();

    // Opening the dialog must not mint a reference until the user confirms.
    await page.getByTestId("subscribe-tc_starter_monthly_v2").click();
    await expect(page.getByTestId("eft-confirm-step")).toBeVisible({ timeout: 10000 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("eft-payment-dialog")).toBeHidden({ timeout: 5000 });
    await expect(page.getByTestId("my-eft-empty")).toBeVisible();
    const noneYet = await page.evaluate(async () => {
      const r = await fetch("/api/eft/my-requests");
      return (await r.json()) as { payments: Array<{ id: string }> };
    });
    expect(noneYet.payments).toEqual([]);

    // --- Request EFT for Starter ---
    await page.getByTestId("subscribe-tc_starter_monthly_v2").click();
    await generateEftReference(page);
    const ref = await page.getByTestId("eft-reference").textContent();
    expect(ref).toMatch(/VEK-[A-Z0-9]{6}/);
    await expect(page.getByTestId("eft-amount")).toContainText("R399,00");
    // The dialog must mirror the bank details the Worker serves, not values
    // copied out of a local .dev.vars.
    const bank = await eftBankDetails(page);
    expect(isEftConfigured(bank), "EFT_* env vars are not configured for this run").toBe(true);
    await expect(page.getByTestId("eft-bank-name")).toContainText(bank.bank_name);
    await expect(page.getByTestId("eft-account-holder")).toContainText(bank.account_holder);
    await expect(page.getByTestId("eft-account-number")).toContainText(bank.account_number);
    await expect(page.getByTestId("eft-branch-code")).toContainText(bank.branch_code);
    await expect(page.getByTestId("eft-account-type")).toContainText(bank.account_type);

    // Upload proof (PNG) — wait for upload-proof response
    const proofBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // minimal PNG header
    const [uploadResp] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/eft/upload-proof/") && resp.request().method() === "POST",
        { timeout: 15000 },
      ),
      page.getByTestId("eft-proof-file-input").setInputFiles({
        name: "proof.png",
        mimeType: "image/png",
        buffer: proofBuffer,
      }),
    ]);
    expect(uploadResp.ok()).toBe(true);
    // After upload, should show pending_review submitted view
    await expect(page.getByTestId("eft-submitted")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("eft-submitted-status")).toContainText("Pending review");
    // Close dialog and wait for the billing list refresh.
    const myReqsPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/eft/my-requests"),
      { timeout: 15000 },
    );
    await page.getByTestId("eft-close-btn").click();
    await expect(page.getByTestId("eft-payment-dialog")).toBeHidden({ timeout: 5000 });
    await myReqsPromise;

    // My requests list should now show pending_review
    await expect(page.getByTestId("my-eft-payments-section")).toBeVisible({ timeout: 8000 });
    const statusRow = page.locator('[data-testid^="eft-status-"]').first();
    await expect(statusRow).toBeVisible();
    await expect(statusRow).toContainText("Pending review");
    const rowId = await statusRow.getAttribute("data-testid");
    const paymentId = rowId?.replace("eft-status-", "") ?? "";
    expect(paymentId).toBeTruthy();
    await expect(page.getByTestId(`eft-row-reference-${paymentId}`)).toContainText(/VEK-/);
    await expect(page.getByTestId(`eft-row-status-${paymentId}`)).toContainText("Pending review");

    // Verify via API: GET /api/eft/my-requests
    const myReqs = await page.evaluate(async () => {
      const r = await fetch("/api/eft/my-requests");
      return (await r.json()) as {
        payments: Array<{ id: string; status: string; reference: string }>;
      };
    });
    expect(myReqs.payments.length).toBeGreaterThanOrEqual(1);
    const created = myReqs.payments.find((p) => p.id === paymentId);
    expect(created).toBeDefined();
    expect(created?.status).toBe("pending_review");

    const unreviewedReplacement = await page.request.post(`/api/eft/upload-proof/${paymentId}`, {
      multipart: {
        file: {
          name: "replacement.png",
          mimeType: "image/png",
          buffer: proofBuffer,
        },
      },
    });
    expect(unreviewedReplacement.status()).toBe(400);
    expect(((await unreviewedReplacement.json()) as { detail: string }).detail).toContain(
      "pending_review",
    );

    // Cancellation from pending_review (spec allows pending_review or awaiting_proof)
    await page.getByTestId(`eft-cancel-${paymentId}`).click();
    // After cancel, row should disappear
    await expect(page.getByTestId(`eft-status-${paymentId}`)).toBeHidden({ timeout: 8000 });

    const afterCancel = await page.evaluate(async () => {
      const r = await fetch("/api/eft/my-requests");
      return (await r.json()) as { payments: Array<{ id: string }> };
    });
    expect(afterCancel.payments.find((p) => p.id === paymentId)).toBeUndefined();

    // --- Test awaiting_proof cancellation via direct API (not via dialog orphan handling) ---
    // Create another request directly via API, then cancel via DELETE
    const secondPayment = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const companyId = comps[0]!.id;
      const res = await fetch("/api/eft/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup_key: "tc_credits_1_v2", company_id: companyId }),
      });
      return (await res.json()) as { id: string; status: string; reference: string };
    });
    expect(secondPayment.status).toBe("awaiting_proof");
    expect(secondPayment.reference).toMatch(/VEK-/);

    // Verify it appears in list
    await page.reload();
    await expect(page.getByTestId("my-eft-payments-section")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId(`eft-status-${secondPayment.id}`)).toBeVisible();
    await expect(page.getByTestId(`eft-status-${secondPayment.id}`)).toContainText(
      "Awaiting proof",
    );

    // Cancel via UI
    await page.getByTestId(`eft-cancel-${secondPayment.id}`).click();
    await expect(page.getByTestId(`eft-status-${secondPayment.id}`)).toBeHidden({ timeout: 8000 });
  });

  test("billing has no accessibility violations", async ({ page }) => {
    await signUpWithCompany(page, "A11y Billing User", {
      companyName: "A11y Pty Ltd",
      cipc: "2020/123456/07",
    });
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-title")).toBeVisible({ timeout: 10000 });
    await expectNoA11yViolations(page, "/billing");
  });

  test("bank details endpoint serves the configured EFT fields and the package catalog is correct via API", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // public catalog check via API without auth
    const catalogRes = await page.request.get("/api/billing/packages");
    expect(catalogRes.ok()).toBe(true);
    const catalog = (await catalogRes.json()) as {
      packages: Array<{
        id: string;
        amount: number;
        credits: number;
        type: string;
        interval: string | null;
        is_popular: boolean;
        billing_period: string;
      }>;
    };
    expect(catalog.packages).toHaveLength(4);
    const starter = catalog.packages.find((p) => p.id === "tc_starter_monthly_v2");
    expect(starter).toMatchObject({
      amount: 399,
      credits: 5,
      type: "subscription",
      interval: "month",
      billing_period: "monthly",
    });
    const pro = catalog.packages.find((p) => p.id === "tc_pro_monthly_v2");
    expect(pro?.is_popular).toBe(true);
    const payg = catalog.packages.find((p) => p.id === "tc_credits_1_v2");
    expect(payg).toMatchObject({
      amount: 149,
      credits: 1,
      type: "one_time",
      billing_period: "one_time",
    });

    await signUp(page, "Bank Details User");

    const bank = await eftBankDetails(page);
    expect(isEftConfigured(bank), "EFT_* env vars are not configured for this run").toBe(true);
    expect(bank.bank_name).toBeTruthy();
    expect(bank.branch_code).toBeTruthy();
    expect(bank.account_type).toBeTruthy();
  });
});
