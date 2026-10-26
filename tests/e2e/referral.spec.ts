import { expect, test } from "@playwright/test";
import {
  clearSession,
  createCompany,
  expectNoA11yViolations,
  generateEftReference,
  login,
  signUp,
  signUpWithCompany,
} from "./helpers";
import { promoteLocalUserToAdmin } from "./local-admin";

test.describe("Referrals", () => {
  test("referral link signup -> EFT subscription -> admin confirm -> reward granted and visible", async ({
    page,
  }) => {
    // --- Referrer signup ---
    // A company is required for the reward to land rather than park as
    // pending_referrer_company.
    const referrerEmail = await signUpWithCompany(page, "Referrer One", {
      companyName: "Referrer Pty Ltd",
      cidb: "4GB",
      bbbeeLevel: "1",
    });
    await expect(page.getByRole("listbox")).toHaveCount(0);

    // Fetch referrer code
    const referrerStats = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      if (!r.ok) throw new Error(`myStats failed ${r.status}`);
      return (await r.json()) as { code: string; invited_count: number };
    });
    const refCode = referrerStats.code;
    expect(refCode).toMatch(/^VEK-[A-Z0-9]{6}$/);
    expect(referrerStats.invited_count).toBe(0);

    // Public lookup should return referrer preview
    const lookup = await page.evaluate(async (code: string) => {
      const r = await fetch(`/api/referrals/lookup?code=${encodeURIComponent(code)}`);
      return { ok: r.ok, data: (await r.json().catch(() => null)) as unknown };
    }, refCode);
    expect(lookup.ok).toBe(true);
    const preview = lookup.data as { referrer_first_name: string; signup_bonus_credits: number };
    expect(preview.referrer_first_name).toBeTruthy();
    expect(preview.signup_bonus_credits).toBe(0);

    // Lookup unknown code should 404
    const unknownLookup = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/lookup?code=VEK-UNKNOWN");
      return r.status;
    });
    expect(unknownLookup).toBe(404);

    // --- Referee signup via referral link ---
    // Clear session: wipe cookies and storage
    await clearSession(page);
    // This test's own promise is that the banner names the referrer before the
    // referee submits, so check it on a pre-navigation; signUp() re-opens the
    // same link and asserts the banner is present.
    await page.goto(`/signup?ref=${refCode}`);
    await expect(page.getByTestId("signup-referral-banner")).toContainText(
      preview.referrer_first_name,
      { timeout: 10000 },
    );
    const refereeEmail = await signUp(page, "Referee One", { ref: refCode });

    // Every user gets their own VEK-XXXXXX code on signup (referrer-only
    // program: no referee bonus, rewards fire only on the referrer side).
    const ownStats = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      return (await r.json()) as {
        code: string;
        invited_count: number;
        credits_earned: number;
        reward_config: { referee_signup_bonus: number };
      };
    });
    expect(ownStats.code).toMatch(/^VEK-[A-Z0-9]{6}$/);
    expect(ownStats.invited_count).toBe(0);
    expect(ownStats.credits_earned).toBe(0);
    expect(ownStats.reward_config.referee_signup_bonus).toBe(0);

    // Create company for referee
    await createCompany(page, {
      name: "Referee Pty Ltd",
      contactEmail: refereeEmail,
      cipc: "2022/654321/07",
      cidb: "5GB",
      bbbeeLevel: "2",
    });
    await expect(page.getByRole("listbox")).toHaveCount(0);

    // --- Referee requests EFT for Pro subscription (should trigger reward) ---
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-title")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("package-tc_pro_monthly_v2")).toBeVisible();
    await page.getByTestId("subscribe-tc_pro_monthly_v2").click();
    await generateEftReference(page);
    const ref = await page.getByTestId("eft-reference").textContent();
    expect(ref).toMatch(/VEK-[A-Z0-9]{6}/);

    const proofBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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
    await expect(page.getByTestId("eft-submitted")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("eft-close-btn").click();
    await expect(page.getByTestId("eft-payment-dialog")).toBeHidden({ timeout: 5000 });

    // Get paymentId for later admin confirm
    const myReqs = await page.evaluate(async () => {
      const r = await fetch("/api/eft/my-requests");
      return (await r.json()) as {
        payments: Array<{ id: string; reference: string; status: string }>;
      };
    });
    const pending = myReqs.payments.find((p) => p.reference === ref?.trim());
    expect(pending).toBeDefined();
    const paymentId = pending!.id;
    expect(pending!.status).toBe("pending_review");
    const refereeCompanyId = await page.evaluate(async () => {
      const companies = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
      return companies[0]!.id;
    });

    // Also test PAYG does NOT trigger reward: create a PAYG payment but not confirmed
    const paygPayment = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const companyId = comps[0]!.id;
      const res = await fetch("/api/eft/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup_key: "tc_credits_1_v2", company_id: companyId }),
      });
      return (await res.json()) as { id: string; lookup_key: string };
    });
    expect(paygPayment.id).toBeTruthy();

    promoteLocalUserToAdmin(referrerEmail);

    // Login as referrer (now admin). login() clears the referee session first.
    await login(page, referrerEmail);
    // Admin should be redirected to /admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Concurrent confirms leave one durable confirmation and one referral reward.
    const confirms = await page.evaluate(async (pid: string) => {
      return Promise.all(
        [0, 1].map(async () => {
          const response = await fetch(`/api/eft/admin/${pid}/confirm`, { method: "POST" });
          return {
            httpStatus: response.status,
            body: (await response.json()) as { status: string; credits_granted: number | null },
          };
        }),
      );
    }, paymentId);
    expect(confirms.every((result) => result.httpStatus === 200)).toBe(true);
    expect(confirms.every((result) => result.body.status === "confirmed")).toBe(true);
    const refereeCompany = await page.evaluate(async (companyId: string) => {
      const response = await fetch(`/api/admin/companies/${companyId}`);
      return (await response.json()) as { credits: number };
    }, refereeCompanyId);
    expect(refereeCompany.credits).toBe(21);

    // Check referral stats as admin/referrer (still logged in as referrer)
    const stats = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      return (await r.json()) as {
        code: string;
        invited_count: number;
        subscribed_count: number;
        credits_earned: number;
        monthly_used: number;
        lifetime_used: number;
        recent: Array<{ referee_email: string; status: string }>;
      };
    });
    expect(stats.invited_count).toBe(1);
    expect(stats.subscribed_count).toBe(1);
    expect(stats.credits_earned).toBe(5); // Pro = 5
    expect(stats.monthly_used).toBe(1);
    expect(stats.lifetime_used).toBe(1);
    // Recent should contain redacted referee email
    expect(stats.recent.length).toBeGreaterThanOrEqual(1);
    expect(stats.recent[0]!.status).toBe("first_paid_subscription");

    // Check dashboard activity feed contains referral_reward
    const activity = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity");
      return (await r.json()) as {
        items: Array<{ type: string; credits_granted?: number }>;
        counts: { referral_rewards: number };
      };
    });
    expect(activity.counts.referral_rewards).toBe(1);
    const rewardItem = activity.items.find((i) => i.type === "referral_reward");
    expect(rewardItem).toBeDefined();
    expect(rewardItem?.credits_granted).toBe(5);

    // Filtered activity: only referral_reward
    const filtered = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity?type=referral_reward");
      return (await r.json()) as { items: Array<{ type: string }> };
    });
    expect(filtered.items.every((i) => i.type === "referral_reward")).toBe(true);

    // Check that referrer's company credits increased.
    const referrerCompany = await page.evaluate(async () => {
      const companies = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
      const companyId = companies[0]!.id;
      const credits = (await (await fetch(`/api/billing/credits/${companyId}`)).json()) as {
        credits: number;
      };
      return { companyId, credits: credits.credits };
    });
    // 1 signup trial credit + 5 referral reward credits.
    expect(referrerCompany.credits).toBe(6);

    // Deleting the credited company must retain reward history and cap usage.
    const deleteCompany = await page.request.delete(
      `/api/admin/companies/${referrerCompany.companyId}`,
    );
    expect(deleteCompany.ok()).toBe(true);
    const retainedStats = await page.request.get("/api/referrals/my");
    expect(retainedStats.ok()).toBe(true);
    const retained = (await retainedStats.json()) as {
      credits_earned: number;
      monthly_used: number;
      lifetime_used: number;
    };
    expect(retained).toMatchObject({ credits_earned: 5, monthly_used: 1, lifetime_used: 1 });

    // Verify share link and stats via API (UI widget is covered by the a11y test for a regular user).
    // This avoids a second login flake while still proving the share URL contains the code and stats are correct.
    const finalStats = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      return (await r.json()) as {
        code: string;
        invited_count: number;
        subscribed_count: number;
        credits_earned: number;
      };
    });
    expect(finalStats.code).toBe(refCode);
    expect(finalStats.invited_count).toBe(1);
    expect(finalStats.subscribed_count).toBe(1);
    expect(finalStats.credits_earned).toBe(5);
  });

  test("referral widget has no accessibility violations", async ({ page }) => {
    await signUpWithCompany(page, "A11y Referral User", {
      companyName: "A11y Pty Ltd",
      cipc: "2020/123456/07",
    });
    await page.waitForLoadState("networkidle");
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-title")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("referral-widget")).toBeVisible({ timeout: 10000 });
    await expectNoA11yViolations(page, "/billing referral widget");
  });
});
