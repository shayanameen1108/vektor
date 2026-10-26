import { expect, test } from "@playwright/test";

import {
  createCompany,
  daysFromNow,
  eftBankDetails,
  generateEftReference,
  isEftConfigured,
  login,
  RESEND_TEST_INBOX,
  signUp,
  TEST_PASSWORD,
  uniqueEmail,
} from "./helpers";
import { pdfFixture } from "./fixtures";
import { isLocalE2E, promoteLocalUserToAdmin } from "./local-admin";

/**
 * Big-bang preview smoke.
 *
 * One serial journey exercising the full vertical chain end to end:
 *   tender analysis (Workers AI) → SBD 4 / SBD 6.1 downloads →
 *   EFT request + proof upload → admin confirm (idempotent, grants credits)
 *   → referral reward → dashboard activity feed → reminder sweep idempotency.
 *
 * Runs against `vite preview` locally (sends via Resend to dead
 * @example.com addresses) and against a `wrangler versions upload` preview when
 * SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD point at an operator-seeded remote
 * admin account. Local runs promote a throwaway user directly in local D1.
 */
test("preview smoke — full vertical chain", async ({ browser }) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString(36);

  // --- Referrer ------------------------------------------------------------
  const referrerCtx = await browser.newContext();
  const referrerPage = await referrerCtx.newPage();
  const referrerEmail = await signUp(referrerPage, "Smoke Referrer", {
    email: uniqueEmail(`smoke-ref-${stamp}`),
  });
  const refCode = await referrerPage.evaluate(async () => {
    const r = await fetch("/api/referrals/my");
    return { ok: r.ok, code: ((await r.json()) as { code: string }).code };
  });
  expect(refCode.ok).toBe(true);
  expect(refCode.code).toMatch(/VEK-[A-Z0-9]{6}/);
  const refCodeStr = refCode.code;
  // The reward only grants once the referrer has a company (ported rule:
  // otherwise it is parked as pending_referrer_company) — set one up now.
  await createCompany(referrerPage, {
    name: `Smoke Ref Co ${stamp} Pty Ltd`,
    contactEmail: referrerEmail,
    cipc: "2020/123456/07",
    cidb: "5GB",
    bbbeeLevel: "1",
  });
  const refStatsBefore = await referrerPage.evaluate(async () => {
    const r = await fetch("/api/referrals/my");
    return (await r.json()) as { credits_earned: number };
  });

  // --- Referee signs up through the referral link ---------------------------
  const userCtx = await browser.newContext();
  const userPage = await userCtx.newPage();
  const userEmail = uniqueEmail(`smoke-user-${stamp}`);
  await signUp(userPage, "Smoke Referee", { email: userEmail, ref: refCodeStr });
  await createCompany(userPage, {
    name: `Smoke Co ${stamp} Pty Ltd`,
    contactEmail: RESEND_TEST_INBOX,
    cidb: "4EB",
    bbbeeLevel: "1",
  });

  const companyId = await userPage.evaluate(async () => {
    const comps = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
    return comps[0]!.id;
  });
  const creditsBefore = await userPage.evaluate(async (cid) => {
    const r = await fetch(`/api/billing/credits/${cid}`);
    return ((await r.json()) as { credits: number }).credits;
  }, companyId);

  // --- Tender analysis (Workers AI) -----------------------------------------
  await userPage.goto("/analyze");
  await userPage.waitForLoadState("networkidle");
  await expect(userPage.getByTestId("upload-card")).toBeVisible({ timeout: 15000 });
  await userPage.getByTestId("file-input").setInputFiles(pdfFixture("tender-4eb.pdf"));
  await expect(userPage.getByTestId("selected-file-name")).toContainText("tender-4eb");
  await userPage.getByTestId("analyze-btn").click();
  await expect(userPage.getByTestId("results-section")).toBeVisible({ timeout: 120_000 });
  await expect(userPage.getByTestId("verdict-label")).toContainText(/GO|CAUTION|NO-GO/);

  // --- SBD 4 and SBD 6.1 downloads ------------------------------------------
  await expect(userPage.getByTestId("download-sbd4-btn")).toBeVisible({ timeout: 10000 });
  await expect(userPage.getByTestId("download-sbd61-btn")).toBeVisible({ timeout: 10000 });
  const [download4] = await Promise.all([
    userPage.waitForEvent("download", { timeout: 15000 }),
    userPage.getByTestId("download-sbd4-btn").click(),
  ]);
  expect(download4.suggestedFilename()).toMatch(/^SBD4.*\.pdf$/);
  const [download61] = await Promise.all([
    userPage.waitForEvent("download", { timeout: 15000 }),
    userPage.getByTestId("download-sbd61-btn").click(),
  ]);
  expect(download61.suggestedFilename()).toMatch(/^SBD61.*\.pdf$/);
  // Per-tender persistent actions serve valid PDF bytes for the analyzed tender
  const tenderId = await userPage.evaluate(async () => {
    const comps = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
    const list = (await (await fetch(`/api/tenders/${comps[0]!.id}`)).json()) as Array<{
      id: string;
    }>;
    return list[0]!.id;
  });
  const sbdProbe = await userPage.evaluate(async (tid) => {
    const res = await fetch(`/api/tender/${tid}/sbd4`);
    const buf = await res.arrayBuffer();
    return {
      status: res.status,
      ct: res.headers.get("content-type") ?? "",
      head: new TextDecoder().decode(new Uint8Array(buf).slice(0, 5)),
    };
  }, tenderId);
  expect(sbdProbe.status).toBe(200);
  expect(sbdProbe.ct).toContain("application/pdf");
  expect(sbdProbe.head).toBe("%PDF-");

  // --- EFT request for a Pro subscription + proof upload --------------------
  await userPage.goto("/billing");
  await userPage.waitForLoadState("networkidle");
  await expect(userPage.getByTestId("billing-title")).toBeVisible({ timeout: 15000 });
  await userPage.getByTestId("subscribe-tc_pro_monthly_v2").click();
  await generateEftReference(userPage);
  const eftRefText = await userPage.getByTestId("eft-reference").textContent();
  expect(eftRefText).toMatch(/VEK-[A-Z0-9]{6}/);
  const eftReference = eftRefText!.trim();
  const bank = await eftBankDetails(userPage);
  expect(isEftConfigured(bank), "EFT_* env vars are not configured for this run").toBe(true);
  await expect(userPage.getByTestId("eft-bank-name")).toContainText(bank.bank_name);
  const proofPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const [uploadResp] = await Promise.all([
    userPage.waitForResponse(
      (resp) => resp.url().includes("/api/eft/upload-proof/") && resp.request().method() === "POST",
      { timeout: 15000 },
    ),
    userPage.getByTestId("eft-proof-file-input").setInputFiles({
      name: "smoke-proof.png",
      mimeType: "image/png",
      buffer: proofPng,
    }),
  ]);
  expect(uploadResp.ok()).toBe(true);
  await expect(userPage.getByTestId("eft-submitted-status")).toContainText("Pending review", {
    timeout: 10000,
  });
  const paymentId = await userPage.evaluate(async (ref: string) => {
    const r = await fetch("/api/eft/my-requests");
    const data = (await r.json()) as { payments: Array<{ id: string; reference: string }> };
    return data.payments.find((p) => p.reference === ref)?.id ?? null;
  }, eftReference);
  expect(paymentId).toBeTruthy();

  // --- Admin confirms the payment ------------------------------------------
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
  if (!isLocalE2E() && (!adminEmail || !adminPassword)) {
    throw new Error("Remote smoke requires SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD");
  }
  const effectiveAdminEmail = adminEmail ?? uniqueEmail(`smoke-admin-${stamp}`);
  const effectiveAdminPassword = adminPassword ?? TEST_PASSWORD;
  if (isLocalE2E() && (!adminEmail || !adminPassword)) {
    const throwaway = await browser.newContext();
    const tp = await throwaway.newPage();
    await signUp(tp, "Smoke Admin", { email: effectiveAdminEmail });
    promoteLocalUserToAdmin(effectiveAdminEmail);
    await throwaway.close();
  }
  // Deterministic admin login (fresh context, unauthenticated)
  await login(adminPage, effectiveAdminEmail, effectiveAdminPassword);
  await expect(adminPage).toHaveURL(/\/admin/, { timeout: 20000 });
  // Settle the client-side redirect before later full-page gotos — the same
  // webkit SPA-guard race clearSession() documents in ./helpers.ts.
  await expect(adminPage.getByTestId("admin-overview-title")).toBeVisible({ timeout: 15000 });

  // Concurrent confirms both observe confirmed; the guarded batch grants once.
  const confirmResults = await adminPage.evaluate(async (pid: string) => {
    return Promise.all(
      [0, 1].map(async () => {
        const response = await fetch(`/api/eft/admin/${pid}/confirm`, { method: "POST" });
        const body = (await response.json().catch(() => null)) as { status?: string } | null;
        return { ok: response.ok, status: body?.status ?? null };
      }),
    );
  }, paymentId!);
  expect(confirmResults.every((result) => result.ok && result.status === "confirmed")).toBe(true);

  // Admin sees the confirmed row under the confirmed filter
  await adminPage.goto("/admin/eft");
  await adminPage.waitForLoadState("networkidle");
  await expect(adminPage.getByTestId("admin-eft-filters")).toBeVisible({ timeout: 15000 });
  {
    const waitResp = adminPage.waitForResponse(
      (resp) =>
        resp.url().includes("/api/eft/admin/all") &&
        resp.url().includes("status=confirmed") &&
        resp.request().method() === "GET",
      { timeout: 15000 },
    );
    await adminPage.getByTestId("admin-eft-filter-confirmed").click();
    await waitResp;
  }
  await expect(adminPage.getByTestId(`admin-eft-row-${paymentId}`)).toContainText("Confirmed", {
    timeout: 10000,
  });

  // --- Credits granted to the referee ---------------------------------------
  const creditsAfter = await userPage.evaluate(async (cid) => {
    const r = await fetch(`/api/billing/credits/${cid}`);
    return ((await r.json()) as { credits: number }).credits;
  }, companyId);
  expect(creditsAfter).toBeGreaterThan(creditsBefore);

  // --- Referral reward on first paid subscription confirmation --------------
  const refStatsAfter = await referrerPage.evaluate(async () => {
    const r = await fetch("/api/referrals/my");
    return (await r.json()) as { credits_earned: number };
  });
  // tc_pro_monthly_v2 → 5 reward credits for the referrer
  expect(refStatsAfter.credits_earned).toBe(refStatsBefore.credits_earned + 5);
  const refActivity = await referrerPage.evaluate(async () => {
    const r = await fetch("/api/dashboard/activity?type=referral_reward");
    return (await r.json()) as { items: Array<{ type: string; credits_granted: number }> };
  });
  expect(
    refActivity.items.some((i) => i.type === "referral_reward" && i.credits_granted === 5),
  ).toBe(true);

  // --- Unified dashboard feed merges streams (no starving) ------------------
  await userPage.goto("/app");
  await userPage.waitForLoadState("networkidle");
  await expect(userPage.getByTestId("recent-activity-panel")).toBeVisible({ timeout: 15000 });
  await expect(userPage.locator('[data-testid^="activity-item-tender-"]').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(userPage.locator('[data-testid^="activity-item-eft-"]').first()).toBeVisible({
    timeout: 15000,
  });

  // --- Reminder sweep idempotency -------------------------------------------
  // Upload a compliance document expiring in exactly 7 days via API
  const expiry7 = daysFromNow(7);
  const certBytes = pdfFixture("cert-tax-pin.pdf").buffer;
  const uploadDoc = await userPage.evaluate(
    async ({ cid, exp, em, bytes }: { cid: string; exp: string; em: string; bytes: number[] }) => {
      const fd = new FormData();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      fd.append("file", blob, "smoke-tax.pdf");
      fd.append("doc_type", "TAX_PIN");
      fd.append("expiry_date", exp);
      fd.append("company_id", cid);
      fd.append("contact_email", em);
      const r = await fetch("/api/documents/upload", { method: "POST", body: fd });
      return r.status;
    },
    { cid: companyId, exp: expiry7, em: userEmail, bytes: [...certBytes] },
  );
  expect([200, 201]).toContain(uploadDoc);

  // First sweep sends the 7-day reminder for our document (admin session)
  const sweep1Json = await adminPage.evaluate(async () => {
    const r = await fetch("/api/reminders/sweep", { method: "POST" });
    return {
      ok: r.ok,
      body: (await r.json()) as {
        sent: number;
        details: Array<{ companyId: string; threshold: number; status: string }>;
      },
    };
  });
  expect(sweep1Json.ok).toBe(true);
  const ours1 = sweep1Json.body.details.filter(
    (d) => d.companyId === companyId && d.threshold === 7 && d.status === "sent",
  );
  expect(ours1.length).toBe(1);

  // Second sweep does not duplicate (per-(company, document, threshold) idempotency)
  const sweep2Json = await adminPage.evaluate(async () => {
    const r = await fetch("/api/reminders/sweep", { method: "POST" });
    return {
      ok: r.ok,
      body: (await r.json()) as {
        sent: number;
        details: Array<{ companyId: string; threshold: number; status: string }>;
      },
    };
  });
  expect(sweep2Json.ok).toBe(true);
  const ours2 = sweep2Json.body.details.filter(
    (d) => d.companyId === companyId && d.threshold === 7 && d.status === "sent",
  );
  expect(ours2.length).toBe(0);

  await adminCtx.close();
  await userCtx.close();
  await referrerCtx.close();
});
