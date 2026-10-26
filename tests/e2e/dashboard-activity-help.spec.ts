import { expect, test } from "@playwright/test";
import { clearSession, expectNoA11yViolations, signUp, signUpWithCompany } from "./helpers";
import { pdfFixture } from "./fixtures";

test.describe("Dashboard, Activity, Static/Help", () => {
  test("landing redirects unauthenticated stays, authenticated -> /app or /admin", async ({
    page,
  }) => {
    // unauthenticated landing
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
    await expect(page.getByTestId("landing-nav")).toBeVisible();

    // signup, then verify the authenticated landing below
    await signUp(page, "Redirect User");

    // now going to / should redirect to /app (user)
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 10000 });
  });

  test("dashboard shows glanceable compliance, CIDB, grid-border cards and links", async ({
    page,
  }) => {
    // CIDB and B-BBEE level are asserted on the dashboard below.
    await signUpWithCompany(page, "Dash User", {
      companyName: "Dash Test Pty Ltd",
      cidb: "4GB, 6CE",
      bbbeeLevel: "2",
    });

    // go to dashboard
    await page.goto("/app");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 10000 });
    // solid header
    await expect(page.getByTestId("page-header")).toBeVisible();

    const grid = page.getByTestId("dashboard-stats-grid");
    await expect(grid).toBeVisible();

    // stat cards — one per metric, no aliasing
    for (const id of ["stat-bbbee", "stat-cidb", "stat-compliance", "stat-avg-score"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // CIDB display should show 4GB
    await expect(page.getByTestId("cidb-display")).toContainText("4GB");
    // bbbee level 2
    await expect(page.getByTestId("stat-bbbee-value")).toContainText("Level 2");
    // compliance status
    await expect(page.getByTestId("stat-compliance")).toContainText(/Documents compliant/);

    // quick actions links
    await expect(page.getByTestId("manage-documents-btn")).toBeVisible();
    await expect(page.getByTestId("edit-profile-btn")).toBeVisible();
    await expect(page.getByTestId("manage-billing-btn")).toBeVisible();
    await expect(page.getByTestId("nav-setup")).toBeVisible();
    await expect(page.getByTestId("nav-documents")).toBeVisible();
    await expect(page.getByTestId("nav-billing")).toBeVisible();
    await expect(page.getByTestId("nav-help")).toBeVisible();

    // recent activity panel and filtering
    await expect(page.getByTestId("recent-activity-panel")).toBeVisible();
    await expect(page.getByTestId("activity-filter-tabs")).toBeVisible();
    await expect(page.getByTestId("activity-tab-all")).toBeVisible();
    await expect(page.getByTestId("activity-tab-tender")).toBeVisible();
    await expect(page.getByTestId("activity-tab-eft")).toBeVisible();
    await expect(page.getByTestId("activity-tab-referral_reward")).toBeVisible();

    // initially empty
    await expect(page.getByTestId("activity-empty")).toBeVisible();
    // switch tabs - should still show empty without error
    await page.getByTestId("activity-tab-tender").click();
    await expect(page.getByTestId("activity-empty")).toBeVisible();
    await page.getByTestId("activity-tab-eft").click();
    await expect(page.getByTestId("activity-empty")).toBeVisible();
    await page.getByTestId("activity-tab-referral_reward").click();
    await expect(page.getByTestId("activity-empty")).toBeVisible();
    await page.getByTestId("activity-tab-all").click();
    await expect(page.getByTestId("activity-empty")).toBeVisible();

    // seed tender + EFT to prove merging without starving any stream
    const tenderBytes = [...pdfFixture("tender-4eb.pdf").buffer];
    const seeded = await page.evaluate(async (bytes: number[]) => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const companyId = comps[0]!.id;
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        "tender.pdf",
      );
      fd.append("company_id", companyId);
      const tenderR = await fetch("/api/tenders/analyze", { method: "POST", body: fd });
      const tenderBody = await tenderR.json().catch(() => null);
      const eftR = await fetch("/api/eft/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup_key: "tc_starter_monthly_v2", company_id: companyId }),
      });
      const eftBody = await eftR.json().catch(() => null);
      return {
        tenderStatus: tenderR.status,
        tenderBody,
        eftStatus: eftR.status,
        eftBody,
        companyId,
      };
    }, tenderBytes);
    expect(seeded.tenderStatus).toBe(200);
    expect(seeded.eftStatus).toBe(201);
    await page.reload();
    await expect(page.getByTestId("recent-activity-panel")).toBeVisible({ timeout: 10000 });
    // unfiltered should contain both tender and eft (proves no starving)
    const allItems = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity");
      return (await r.json()) as { items: Array<{ type: string }> };
    });
    expect(allItems.items.some((i) => i.type === "tender")).toBe(true);
    expect(allItems.items.some((i) => i.type === "eft")).toBe(true);
    // UI: all shows at least two items
    await expect(page.locator('[data-testid^="activity-item-tender-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid^="activity-item-eft-"]').first()).toBeVisible({
      timeout: 10000,
    });
    // filtering preserves each stream
    await page.getByTestId("activity-tab-tender").click();
    await expect(page.locator('[data-testid^="activity-item-tender-"]').first()).toBeVisible({
      timeout: 8000,
    });
    await expect(page.locator('[data-testid^="activity-item-eft-"]')).toHaveCount(0, {
      timeout: 2000,
    });
    await page.getByTestId("activity-tab-eft").click();
    await expect(page.locator('[data-testid^="activity-item-eft-"]').first()).toBeVisible({
      timeout: 8000,
    });
    await page.getByTestId("activity-tab-referral_reward").click();
    await expect(page.getByTestId("activity-empty")).toBeVisible({ timeout: 8000 });
    await page.getByTestId("activity-tab-all").click();
    await expect(page.locator('[data-testid^="activity-item-tender-"]').first()).toBeVisible({
      timeout: 8000,
    });

    // direct API filtering test
    const activityAll = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity");
      return (await r.json()) as { items: Array<{ type: string }> };
    });
    expect(Array.isArray(activityAll.items)).toBe(true);
    const activityTender = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity?type=tender");
      return (await r.json()) as { items: Array<{ type: string }> };
    });
    expect(activityTender.items.every((i) => i.type === "tender")).toBe(true);
    const activityEft = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity?type=eft");
      return (await r.json()) as { items: Array<{ type: string }> };
    });
    expect(activityEft.items.every((i) => i.type === "eft")).toBe(true);
  });

  test("public routes about, terms, privacy, help are present and have correct content", async ({
    page,
  }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("about-page")).toBeVisible();
    await expect(page.getByTestId("about-header")).toBeVisible();
    const headerBg = await page.getByTestId("about-header").evaluate((el) => {
      const color = getComputedStyle(el).backgroundColor;
      return color;
    });
    expect(headerBg).not.toMatch(/^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/);
    await expect(page.getByTestId("about-cidb-link")).toBeVisible();
    await expect(page.getByTestId("about-cipc-link")).toBeVisible();
    await expect(page.getByTestId("about-csd-link")).toBeVisible();
    await expect(page.getByTestId("about-sars-link")).toBeVisible();
    await expect(page.getByTestId("about-bccei-link")).toBeVisible();
    await expect(page).toHaveTitle(/Vektor/);

    await page.goto("/terms");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("terms-page")).toBeVisible();
    await expect(page.getByTestId("terms-header")).toBeVisible();
    await expect(page.getByTestId("terms-cidb-link")).toBeVisible();
    await expect(page.getByTestId("terms-cipc-link")).toBeVisible();
    await expect(page.getByTestId("terms-sars-link")).toBeVisible();

    await page.goto("/privacy");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("privacy-page")).toBeVisible();
    await expect(page.getByTestId("privacy-header")).toBeVisible();
    await expect(page.getByTestId("privacy-cidb-link")).toBeVisible();
    await expect(page.getByTestId("privacy-cipc-link")).toBeVisible();

    // Help as public (no auth)
    await clearSession(page);
    await page.goto("/help");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("help-walkthrough-section")).toBeVisible();
    await expect(page.getByTestId("walkthrough-slides-grid")).toBeVisible();
    // 10 slides
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByTestId(`walkthrough-slide-${i}`)).toBeVisible();
    }
    // check images and captions
    const images = page.locator('[data-testid="walkthrough-slide-image"]');
    await expect(images).toHaveCount(10);
    const titles = page.locator('[data-testid="walkthrough-slide-title"]');
    await expect(titles).toHaveCount(10);
    await expect(page.getByTestId("help-quickstart-section")).toBeVisible();
    await expect(page.getByTestId("qs-step-1")).toBeVisible();
    await expect(page.getByTestId("help-reference-section")).toBeVisible();
    await expect(page.getByTestId("ref-section-bargaining")).toBeVisible();
    await expect(page.getByTestId("help-cidb-link")).toBeVisible();
    await expect(page.getByTestId("help-bccei-link")).toBeVisible();
    await expect(page.getByTestId("help-portal-cidb")).toBeVisible();
    // no TTS audio element
    const audioCount = await page.locator("audio").count();
    expect(audioCount).toBe(0);
  });

  test("help when authenticated shows sidebar and no TTS", async ({ page }) => {
    await signUp(page, "Help Authed");

    await page.goto("/help");
    await page.waitForLoadState("networkidle");
    // should show sidebar when authed
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("help-header-authed")).toBeVisible();
    await expect(page.getByTestId("walkthrough-slides-grid")).toBeVisible();
    // ensure no audio
    expect(await page.locator("audio").count()).toBe(0);
    // all interactive elements have data-testid - check some
    await expect(page.getByTestId("walkthrough-slide-1")).toBeVisible();
  });

  test("public pages and login error toast are reachable", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("about-header")).toBeVisible();
    await expect(page.getByTestId("about-page")).toBeVisible();

    await page.goto("/help");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("help-header")).toBeVisible();

    await page.goto("/terms");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("terms-header")).toBeVisible();

    await page.goto("/privacy");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("privacy-header")).toBeVisible();

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("input-email").fill("sonner.probe@example.com");
    await page.getByTestId("input-password").fill("definitely-not-the-password");
    await page.getByTestId("submit-login").click();
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test("dashboard, help, about, terms, privacy have no accessibility violations", async ({
    page,
  }) => {
    await signUpWithCompany(page, "A11y Dash", {
      companyName: "A11y Pty Ltd",
      cipc: "2020/123456/07",
    });

    const pages: Array<{ path: string; readyTestId: string }> = [
      { path: "/app", readyTestId: "dashboard-title" },
      { path: "/help", readyTestId: "help-walkthrough-section" },
      { path: "/about", readyTestId: "about-page" },
      { path: "/terms", readyTestId: "terms-page" },
      { path: "/privacy", readyTestId: "privacy-page" },
    ];
    for (const { path, readyTestId } of pages) {
      await page.goto(path);
      await expect(page.getByTestId(readyTestId)).toBeVisible({ timeout: 10000 });
      await expectNoA11yViolations(page, path);
    }
  });
});
