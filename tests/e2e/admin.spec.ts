import { expect, test } from "@playwright/test";
import {
  clearSession,
  expectNoA11yViolations,
  login,
  signUpWithCompany,
  uniqueEmail,
} from "./helpers";
import { pdfFixture } from "./fixtures";
import { promoteLocalUserToAdmin } from "./local-admin";

// The setup journey uploads a B-BBEE certificate via page.evaluate(), which
// runs in the browser and cannot touch node:fs — so the fixture bytes travel
// inline as base64, encoded from the committed fixture (single source of truth).
const FIXTURE_B64 = pdfFixture("cert-bbbee-level2.pdf").buffer.toString("base64");

/** Every admin fixture company is a CIDB 4GB, B-BBEE Level 1 contractor. */
const FIXTURE_COMPANY = { cidb: "4GB", bbbeeLevel: "1" } as const;

test.describe("Admin Console", () => {
  test("admin guard: unauthenticated and non-admin cannot access admin routes", async ({
    page,
  }) => {
    // Ensure clean session
    await clearSession(page);

    // Try to access /admin directly unauthenticated -> should redirect to /login
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.getByTestId("login-form")).toBeVisible({ timeout: 10000 });

    for (const path of ["/admin/users", "/admin/companies", "/admin/eft"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }

    const removedRoleRoute = await page.request.post("/api/dev/set-role", {
      data: { email: "nobody@example.com", role: "admin" },
    });
    expect(removedRoleRoute.status()).toBe(404);

    // Create non-admin user
    await signUpWithCompany(page, "Guard User", FIXTURE_COMPANY);

    // Non-admin trying to access admin should redirect to /app
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 10000 });

    for (const path of ["/admin/users", "/admin/companies", "/admin/eft"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
    }

    // Admin nav should not be visible for non-admin (we are already on /app
    // via the guard redirect — an extra goto here races the SPA router)
    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-nav")).toBeHidden();
  });

  test("admin routes have dark navy console, navigation, and overview stats", async ({ page }) => {
    const email = await signUpWithCompany(page, "Admin Overview", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(email);
    // need to re-login to pick up admin role (login() clears the session first)
    await login(page, email);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.getByTestId("admin-nav")).toBeVisible();
    await expect(page.getByTestId("admin-nav-overview")).toBeVisible();
    await expect(page.getByTestId("admin-nav-users")).toBeVisible();
    await expect(page.getByTestId("admin-nav-companies")).toBeVisible();
    await expect(page.getByTestId("admin-nav-eft")).toBeVisible();
    await expect(page.getByTestId("admin-overview-title")).toBeVisible();
    await expect(page.getByTestId("admin-overview-title")).toContainText("Admin Console");
    // Stats tiles
    await expect(page.getByTestId("admin-stat-users")).toBeVisible();
    await expect(page.getByTestId("admin-stat-companies")).toBeVisible();
    await expect(page.getByTestId("admin-stat-eft")).toBeVisible();
    // Stats should be numeric after loading (not just —) since we have at least 1 user/company
    await expect(page.getByTestId("admin-stat-users")).toContainText(/\d/, { timeout: 10000 });
    await expect(page.getByTestId("admin-stat-companies")).toContainText(/\d/, { timeout: 10000 });

    // Quick links
    await expect(page.getByTestId("admin-quick-users")).toBeVisible();
    await expect(page.getByTestId("admin-quick-companies")).toBeVisible();
    await expect(page.getByTestId("admin-quick-eft")).toBeVisible();

    // Navigate to subpages and check nav persists dark console
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-nav")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-users-title")).toBeVisible();
    await expect(page.getByTestId("admin-users-search")).toBeVisible();

    await page.goto("/admin/companies");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-nav")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-companies-title")).toBeVisible();
    await expect(page.getByTestId("admin-companies-search")).toBeVisible();

    await page.goto("/admin/eft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-nav")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-eft-title")).toBeVisible();
    await expect(page.getByTestId("admin-eft-filters")).toBeVisible();
    await expect(page.getByTestId("admin-eft-table")).toBeVisible();
  });

  test("admin can sign out from the console", async ({ page }) => {
    const email = await signUpWithCompany(page, "Admin Signout", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(email);
    await login(page, email);

    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.getByTestId("admin-btn-signout")).toBeVisible();
    await page.getByTestId("admin-btn-signout").click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.getByTestId("login-form")).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("admin help keeps admin navigation and returns to the console", async ({ page }) => {
    const email = await signUpWithCompany(page, "Admin Help", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(email);
    await login(page, email);

    await page.goto("/help");
    await expect(page).toHaveURL(/\/admin\/help/, { timeout: 15000 });
    await expect(page.getByTestId("admin-nav")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-nav-help")).toBeVisible();
    await expect(page.getByTestId("nav-analyze")).toBeHidden();
    await page.getByTestId("admin-nav-overview").click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10000 });
  });

  test("admin can impersonate a user and exit through the visible banner", async ({ page }) => {
    const adminEmail = await signUpWithCompany(page, "Impersonation Admin", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(adminEmail);
    // A second account in the same browser: the admin session has to go first,
    // since /signup redirects an authenticated visitor away.
    await clearSession(page);
    const userEmail = await signUpWithCompany(page, "Impersonation Target", FIXTURE_COMPANY);
    await clearSession(page);
    await login(page, adminEmail);

    await page.goto("/admin/users");
    await expect(page.getByTestId("admin-users-title")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("admin-users-search").fill(userEmail);
    await expect(page.getByRole("button", { name: `Impersonate ${userEmail}` })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: `Impersonate ${userEmail}` }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await expect(page.getByTestId("impersonation-banner")).toContainText(userEmail);
    await page.getByTestId("impersonation-exit").click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.getByTestId("impersonation-banner")).toBeHidden();
    await expect(page.getByTestId("admin-nav")).toBeVisible();
  });

  test("users and companies list, search, detail and delete with cascading note", async ({
    page,
  }) => {
    // Unique per run — the local D1 database persists across e2e runs
    const disposableCompany = `Disposable ${uniqueEmail("co").split("@")[0]!.slice(8)} Pty Ltd`;
    const adminEmail = await signUpWithCompany(page, "Admin List", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(adminEmail);

    // Create a disposable user to delete later
    await clearSession(page);
    const disposableEmail = await signUpWithCompany(page, "Disposable User", {
      companyName: disposableCompany,
      cipc: "2020/999999/07",
      cidb: "5CE",
      bbbeeLevel: "3",
    });

    // Add a compliance doc and tender for that disposable user's company to test compliance history
    // Do via API for speed
    const setupInfo = await page.evaluate(async (fixtureB64: string) => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const cid = comps[0]!.id;
      // upload a compliance doc (fixture bytes serialized in from Node land)
      const fd = new FormData();
      const bytes = Uint8Array.from(atob(fixtureB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      fd.append("file", blob, "bbbee.pdf");
      fd.append("doc_type", "BBBEE");
      fd.append("expiry_date", "2027-12-31");
      fd.append("company_id", cid);
      const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: fd });
      return { companyId: cid, uploadStatus: uploadRes.status };
    }, FIXTURE_B64);
    expect([200, 201].includes(setupInfo.uploadStatus)).toBe(true);

    // Now login as admin
    await login(page, adminEmail);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Go to users list
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-nav-users")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-users-search")).toBeVisible({ timeout: 10000 });
    // List has loaded once the count renders a number
    await expect(page.getByTestId("admin-users-count")).toContainText(/\d/, { timeout: 15000 });
    // Should list at least admin and disposable
    await expect(page.getByText(adminEmail).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(disposableEmail).first()).toBeVisible({ timeout: 15000 });

    // Search filtering is client-side and synchronous; the unique prefix matches only the disposable user
    await page.getByTestId("admin-users-search").fill(disposableEmail.split("@")[0]!);
    await expect(page.getByTestId("admin-users-count")).toHaveText(/^1 users$/, {
      timeout: 10000,
    });
    await expect(page.getByText(disposableEmail).first()).toBeVisible();
    await page.getByTestId("admin-users-search").fill("");
    await expect(page.getByTestId("admin-users-count")).not.toHaveText(/^1 users$/, {
      timeout: 10000,
    });
    await expect(page.getByText(disposableEmail).first()).toBeVisible();

    // Find disposable user row id via API to get id for detail/delete selectors
    const disposableUserId = await page.evaluate(async (em: string) => {
      const r = await fetch("/api/admin/users");
      const users = (await r.json()) as Array<{ id: string; email: string }>;
      const u = users.find((x) => x.email.toLowerCase() === em.toLowerCase());
      return u?.id ?? null;
    }, disposableEmail);
    expect(disposableUserId).toBeTruthy();

    // Detail: click open
    await page.getByTestId(`admin-user-open-${disposableUserId}`).click();
    await expect(page.getByTestId(`admin-user-detail-${disposableUserId}`)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("admin-user-detail-companies")).toBeVisible();
    await expect(page.getByTestId("admin-user-detail-compliance")).toContainText(/docs/);
    await expect(page.getByTestId("admin-user-detail-tenders")).toBeVisible();
    await expect(page.getByTestId("admin-user-detail-credits")).toBeVisible();
    await expect(page.getByTestId("admin-user-detail-eft")).toBeVisible();
    await expect(page.getByTestId("admin-user-detail-reminders")).toBeVisible();
    // Check compliance state is reflected (we uploaded a BBBEE doc)
    await expect(page.getByTestId("admin-user-detail-compliance")).toContainText("BBBEE");

    await page.getByTestId("admin-user-detail-close").click();
    await expect(page.getByTestId(`admin-user-detail-${disposableUserId}`)).toBeHidden();

    // Companies list similar
    await page.goto("/admin/companies");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-companies-search")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(disposableCompany).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("admin-companies-search").fill(disposableCompany.split(" ")[1]!);
    await expect(page.getByText(disposableCompany).first()).toBeVisible();
    await page.getByTestId("admin-companies-search").fill("");
    await expect(page.getByText(disposableCompany).first()).toBeVisible();

    const disposableCompanyId = await page.evaluate(async (cname: string) => {
      const r = await fetch("/api/admin/companies");
      const companies = (await r.json()) as Array<{ id: string; company_name: string }>;
      const c = companies.find((x) => x.company_name === cname);
      return c?.id ?? null;
    }, disposableCompany);
    expect(disposableCompanyId).toBeTruthy();

    // Company detail should show compliance state and tender/credit/reminder history
    await page.getByTestId(`admin-company-open-${disposableCompanyId}`).click();
    await expect(page.getByTestId(`admin-company-detail-${disposableCompanyId}`)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("admin-company-detail-docs")).toContainText("BBBEE");
    await expect(page.getByTestId("admin-company-detail-tenders")).toBeVisible();
    await expect(page.getByTestId("admin-company-detail-credits")).toBeVisible();
    await page.getByTestId("admin-company-detail-close").click();
    await expect(page.getByTestId(`admin-company-detail-${disposableCompanyId}`)).toBeHidden();

    // Delete company with confirmation and cascading note
    const compDeleteBtn = page.getByTestId(`admin-delete-${disposableCompanyId}`);
    await expect(compDeleteBtn).toBeVisible();
    await compDeleteBtn.click();
    await expect(page.getByTestId("admin-delete-dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Cascading deletes").first()).toBeVisible();
    await expect(page.locator("text=Compliance documents").first()).toBeVisible();
    await page.getByTestId("admin-delete-cancel").click();
    await expect(page.getByTestId("admin-delete-dialog")).toBeHidden();

    // Now actually delete
    await page.getByTestId(`admin-delete-${disposableCompanyId}`).click();
    await expect(page.getByTestId("admin-delete-dialog")).toBeVisible();
    await page.getByTestId("admin-delete-confirm").click();
    await expect(page.getByTestId("admin-delete-dialog")).toBeHidden({ timeout: 5000 });
    await expect(page.getByTestId(`admin-row-${disposableCompanyId}`)).toBeHidden({
      timeout: 10000,
    });

    // Verify via API company gone
    const afterCompDelete = await page.evaluate(async (cid: string) => {
      const r = await fetch(`/api/admin/companies/${cid}`);
      return r.status;
    }, disposableCompanyId as string);
    expect(afterCompDelete).toBe(404);

    // Delete user with confirmation noting cascading deletes across all domains
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId(`admin-user-row-${disposableUserId}`)).toBeVisible({
      timeout: 15000,
    });
    await page.getByTestId(`admin-user-delete-${disposableUserId}`).click();
    await expect(page.getByTestId("delete-user-dialog")).toBeVisible({ timeout: 5000 });
    // Check cascading note
    await expect(page.locator("text=Cascading deletes across").first()).toBeVisible();
    await expect(page.locator("text=Compliance documents").first()).toBeVisible();
    await expect(page.locator("text=EFT payments").first()).toBeVisible();
    await expect(page.getByText("Referrals and referral rewards").first()).toBeVisible();
    await page.getByTestId("delete-cancel").click();
    await expect(page.getByTestId("delete-user-dialog")).toBeHidden();

    await page.getByTestId(`admin-user-delete-${disposableUserId}`).click();
    await expect(page.getByTestId("delete-user-dialog")).toBeVisible();
    // require reason and confirm email
    await page.getByTestId("delete-reason").fill("Test cleanup: disposable account");
    await page.getByTestId("delete-confirm-email").fill("wrong@example.com");
    await page.getByTestId("delete-submit").click();
    // should show error toast about email mismatch, dialog stays
    await expect(page.getByTestId("delete-user-dialog")).toBeVisible();
    // fix email
    await page.getByTestId("delete-confirm-email").fill(disposableEmail);
    await page.getByTestId("delete-submit").click();
    await expect(page.getByTestId("delete-user-dialog")).toBeHidden({ timeout: 8000 });
    await expect(page.getByTestId(`admin-user-row-${disposableUserId}`)).toBeHidden({
      timeout: 10000,
    });

    const afterUserDelete = await page.evaluate(async (uid: string) => {
      const r = await fetch(`/api/admin/users/${uid}`);
      return r.status;
    }, disposableUserId as string);
    expect(afterUserDelete).toBe(404);

    // Verify audit: users list no longer contains deleted
    const usersAfter = await page.evaluate(async () => {
      const r = await fetch("/api/admin/users");
      const users = (await r.json()) as Array<{ email: string }>;
      return users.map((u) => u.email.toLowerCase());
    });
    expect(usersAfter).not.toContain(disposableEmail.toLowerCase());
  });

  test("EFT admin list, proof view, confirm grants credits, reject with reason and re-upload", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // Create admin
    const adminEmail = await signUpWithCompany(page, "Admin EFT", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(adminEmail);

    // Create regular user
    await clearSession(page);
    const userEmail = await signUpWithCompany(page, "User EFT", FIXTURE_COMPANY);

    // As user, request EFT for Starter and upload proof -> pending_review
    const starterPayment = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const cid = comps[0]!.id;
      const reqRes = await fetch("/api/eft/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup_key: "tc_starter_monthly_v2", company_id: cid }),
      });
      const body = (await reqRes.json()) as { id: string; reference: string; status: string };
      return body;
    });
    expect(starterPayment.reference).toMatch(/VEK-[A-Z0-9]{6}/);
    expect(starterPayment.status).toBe("awaiting_proof");

    await page.evaluate(async (pid: string) => {
      const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const blob = new Blob([buf], { type: "image/png" });
      const file = new File([blob], "proof.png", { type: "image/png" });
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/eft/upload-proof/${pid}`, { method: "POST", body: fd });
    }, starterPayment.id);

    const afterUpload = await page.evaluate(async (pid: string) => {
      const r = await fetch("/api/eft/my-requests");
      const data = (await r.json()) as { payments: Array<{ id: string; status: string }> };
      return data.payments.find((p) => p.id === pid)?.status;
    }, starterPayment.id);
    expect(afterUpload).toBe("pending_review");

    // Capture company id and initial credits for later credit grant check
    const companyId = await page.evaluate(async () => {
      const r = await fetch("/api/companies");
      const comps = (await r.json()) as Array<{ id: string }>;
      return comps[0]!.id;
    });
    const creditsBefore = await page.evaluate(async (cid: string) => {
      const r = await fetch(`/api/billing/credits/${cid}`);
      const data = (await r.json()) as { credits: number };
      return data.credits;
    }, companyId);

    // Login as admin
    await login(page, adminEmail);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await page.goto("/admin/eft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-eft-filters")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-eft-table")).toBeVisible();
    // Should see pending payment row
    await expect(page.getByTestId(`admin-eft-row-${starterPayment.id}`)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId(`admin-eft-view-proof-${starterPayment.id}`)).toBeVisible();

    // View proof
    await page.getByTestId(`admin-eft-view-proof-${starterPayment.id}`).click();
    await expect(page.getByTestId("admin-eft-proof-dialog")).toBeVisible({ timeout: 8000 });
    // Should show image for PNG
    await expect(page.getByTestId("admin-eft-proof-image")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("admin-eft-proof-download")).toBeVisible();
    // Close via close button
    await page.getByTestId("admin-eft-proof-close").click();
    await expect(page.getByTestId("admin-eft-proof-dialog")).toBeHidden();

    // Confirm through the visible canonical alert dialog.
    await page.getByTestId(`admin-eft-confirm-${starterPayment.id}`).click();
    await expect(page.getByTestId("admin-eft-confirm-dialog")).toBeVisible();
    const confirmResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/eft/admin/${starterPayment.id}/confirm`) &&
        response.request().method() === "POST",
    );
    await page.getByTestId("admin-eft-confirm-submit").click();
    expect((await confirmResponse).ok()).toBe(true);
    await expect(page.getByTestId("admin-eft-confirm-dialog")).toBeHidden();
    await page.reload();
    await expect(page.getByTestId("admin-eft-filters")).toBeVisible({ timeout: 10000 });
    {
      const waitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/eft/admin/all") &&
          resp.url().includes("status=confirmed") &&
          resp.request().method() === "GET",
        { timeout: 15000 },
      );
      await page.getByTestId("admin-eft-filter-confirmed").click();
      await waitResp;
    }
    const starterVisibleViaApi = await page.evaluate(async (pid: string) => {
      const r = await fetch("/api/eft/admin/all?status=confirmed");
      const data = (await r.json()) as { payments: Array<{ id: string }> };
      return data.payments.some((p) => p.id === pid);
    }, starterPayment.id);
    expect(starterVisibleViaApi).toBe(true);
    await expect(page.getByTestId(`admin-eft-row-${starterPayment.id}`)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(`[data-testid="admin-eft-row-${starterPayment.id}"]`)).toContainText(
      "Confirmed",
    );

    // Idempotent second confirm should return 200
    const secondConfirm = await page.evaluate(async (pid: string) => {
      const r = await fetch(`/api/eft/admin/${pid}/confirm`, { method: "POST" });
      return r.status;
    }, starterPayment.id);
    expect(secondConfirm).toBe(200);

    // Check credits granted
    // Need to login as user again to check credits or stay as admin can still query?
    // As admin we can query billing credits endpoint for that user's company? But company belongs to user, not admin. Admin can still query via direct DB? We'll just check via API as user
    await login(page, userEmail);
    // after login, user should be at /app, but we can check credits
    const creditsAfter = await page.evaluate(async (cid: string) => {
      const r = await fetch(`/api/billing/credits/${cid}`);
      const data = (await r.json()) as { credits: number };
      return data.credits;
    }, companyId);
    expect(creditsAfter).toBeGreaterThan(creditsBefore);

    // Create two distinct subscription renewals before returning to the admin.
    const renewals = await page.evaluate(async (cid: string) => {
      const ids: string[] = [];
      for (const suffix of ["a", "b"]) {
        const request = await fetch("/api/eft/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lookup_key: "tc_starter_monthly_v2", company_id: cid }),
        });
        const payment = (await request.json()) as { id: string };
        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], `renewal-${suffix}.png`, {
          type: "image/png",
        });
        const form = new FormData();
        form.append("file", file);
        const upload = await fetch(`/api/eft/upload-proof/${payment.id}`, {
          method: "POST",
          body: form,
        });
        if (!upload.ok) throw new Error(`Renewal upload failed: ${upload.status}`);
        ids.push(payment.id);
      }
      return ids;
    }, companyId);

    // Check that admin confirmed is auditable via D1 state and rollover is capped.
    await login(page, adminEmail);
    const renewalBalances: number[] = [];
    const renewalGrants: number[] = [];
    for (const renewalId of renewals) {
      const confirmation = await page.request.post(`/api/eft/admin/${renewalId}/confirm`);
      expect(confirmation.ok()).toBe(true);
      const confirmed = (await confirmation.json()) as { credits_granted: number };
      renewalGrants.push(confirmed.credits_granted);
      const companiesResponse = await page.request.get(
        `/api/admin/companies?q=${encodeURIComponent(userEmail)}`,
      );
      const companyRows = (await companiesResponse.json()) as Array<{
        id: string;
        credits: number;
      }>;
      renewalBalances.push(companyRows.find((company) => company.id === companyId)!.credits);
    }
    expect(renewalBalances).toEqual([10, 10]);
    expect(renewalGrants).toEqual([4, 0]);
    const paymentDetail = await page.evaluate(async (pid: string) => {
      const r = await fetch(`/api/eft/admin/all`);
      const data = (await r.json()) as {
        payments: Array<{
          id: string;
          status: string;
          credits_granted: number | null;
          confirmed_at: string | null;
        }>;
      };
      return data.payments.find((p) => p.id === pid);
    }, starterPayment.id);
    expect(paymentDetail?.status).toBe("confirmed");
    expect(paymentDetail?.credits_granted).toBeGreaterThan(0);
    expect(paymentDetail?.confirmed_at).toBeTruthy();

    // Now test reject path: create another payment as user, upload proof, admin reject, user re-upload, admin confirm
    await login(page, userEmail);
    const paygPayment = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const cid = comps[0]!.id;
      const reqRes = await fetch("/api/eft/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup_key: "tc_credits_1_v2", company_id: cid }),
      });
      return (await reqRes.json()) as { id: string; reference: string };
    });
    await page.evaluate(async (pid: string) => {
      const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      const blob = new Blob([buf], { type: "application/pdf" });
      const file = new File([blob], "proof2.pdf", { type: "application/pdf" });
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/eft/upload-proof/${pid}`, { method: "POST", body: fd });
    }, paygPayment.id);

    // Login as admin to reject
    await login(page, adminEmail);
    // The EFT console defaults to the pending_review filter; bind to its initial load
    const pendingLoad = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/eft/admin/all") &&
        resp.url().includes("status=pending_review") &&
        resp.request().method() === "GET",
      { timeout: 15000 },
    );
    await page.goto("/admin/eft");
    await pendingLoad;
    await expect(page.getByTestId("admin-eft-filters")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`admin-eft-row-${paygPayment.id}`)).toBeVisible({
      timeout: 10000,
    });

    // Try reject without reason via API should 400
    const rejectNoReason = await page.evaluate(async (pid: string) => {
      const r = await fetch(`/api/eft/admin/${pid}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
      return r.status;
    }, paygPayment.id);
    expect(rejectNoReason).toBe(400);

    // Proper reject via UI button
    await page.getByTestId(`admin-eft-reject-${paygPayment.id}`).click();
    await expect(page.getByTestId("admin-eft-reject-dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("admin-eft-reject-reason")).toBeVisible();
    // Try submit empty
    await page.getByTestId("admin-eft-reject-submit").click();
    await expect(page.getByTestId("admin-eft-reject-dialog")).toBeVisible();
    await page.getByTestId("admin-eft-reject-reason").fill("Proof amount mismatch - test");
    await page.getByTestId("admin-eft-reject-submit").click();
    await expect(page.getByTestId("admin-eft-reject-dialog")).toBeHidden({ timeout: 5000 });
    {
      const waitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/eft/admin/all") &&
          resp.url().includes("status=rejected") &&
          resp.request().method() === "GET",
        { timeout: 15000 },
      );
      await page.getByTestId("admin-eft-filter-rejected").click();
      await waitResp;
    }
    await expect(page.getByTestId(`admin-eft-row-${paygPayment.id}`)).toBeVisible();
    await expect(page.locator(`[data-testid="admin-eft-row-${paygPayment.id}"]`)).toContainText(
      "Rejected",
    );

    // Verify audit: status rejected and reason stored
    const rejectedPayment = await page.evaluate(async (pid: string) => {
      const r = await fetch("/api/eft/admin/all?status=rejected");
      const data = (await r.json()) as {
        payments: Array<{ id: string; reject_reason: string | null; status: string }>;
      };
      return data.payments.find((p) => p.id === pid);
    }, paygPayment.id);
    expect(rejectedPayment?.status).toBe("rejected");
    expect(rejectedPayment?.reject_reason).toContain("mismatch");

    // User re-upload after rejection should return to pending_review
    await login(page, userEmail);
    const reuploadRes = await page.evaluate(async (pid: string) => {
      const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const blob = new Blob([buf], { type: "image/png" });
      const file = new File([blob], "reupload.png", { type: "image/png" });
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/eft/upload-proof/${pid}`, { method: "POST", body: fd });
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) };
    }, paygPayment.id);
    expect(reuploadRes.ok).toBe(true);
    expect((reuploadRes.body as { status: string }).status).toBe("pending_review");

    // Admin can now confirm the re-uploaded payment
    await login(page, adminEmail);
    const finalConfirm = await page.evaluate(async (pid: string) => {
      const r = await fetch(`/api/eft/admin/${pid}/confirm`, { method: "POST" });
      return { ok: r.ok, status: r.status };
    }, paygPayment.id);
    expect(finalConfirm.ok).toBe(true);

    await page.goto("/admin/eft");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("admin-eft-filters")).toBeVisible({ timeout: 15000 });
    {
      const waitResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/eft/admin/all") &&
          resp.url().includes("status=confirmed") &&
          resp.request().method() === "GET",
        { timeout: 15000 },
      );
      await page.getByTestId("admin-eft-filter-confirmed").click();
      await waitResp;
    }
    // Check via API as primary assertion, UI must agree
    const confirmedViaApi = await page.evaluate(async (pid: string) => {
      const r = await fetch("/api/eft/admin/all?status=confirmed");
      const data = (await r.json()) as { payments: Array<{ id: string }> };
      return data.payments.some((p) => p.id === pid);
    }, paygPayment.id);
    expect(confirmedViaApi).toBe(true);
    await expect(page.getByTestId(`admin-eft-row-${paygPayment.id}`)).toBeVisible({
      timeout: 10000,
    });

    // Check referral reward side-effect not triggered for PAYG (should be 0 credits reward for PAYG)
    // Create referral scenario: referrer admin invites new user via referral link, new user does subscription, admin confirms, check reward 3/5/10
    // This part is covered in referral.spec.ts, but we can do quick check for starter reward via fresh referral
    const referrerEmail = adminEmail;
    const referrerCode = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      if (!r.ok) return null;
      const data = (await r.json()) as { code: string };
      return data.code as string;
    });
    expect(referrerCode).toMatch(/VEK-/);

    // Create new referee via referral link. `ref` makes signUp() open
    // /signup?ref=… and assert the referral banner it shows.
    await clearSession(page);
    await signUpWithCompany(page, "Reward Referee", {
      ref: referrerCode!,
      companyName: "Reward Referee Pty Ltd",
      cipc: "2022/111111/07",
      cidb: "6CE",
      bbbeeLevel: "1",
    });

    const rewardPayment = await page.evaluate(async () => {
      const compRes = await fetch("/api/companies");
      const comps = (await compRes.json()) as Array<{ id: string }>;
      const cid = comps[0]!.id;
      const r = await fetch("/api/eft/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookup_key: "tc_pro_monthly_v2", company_id: cid }),
      });
      return (await r.json()) as { id: string };
    });
    await page.evaluate(async (pid: string) => {
      const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const blob = new Blob([buf], { type: "image/png" });
      const file = new File([blob], "p.png", { type: "image/png" });
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/eft/upload-proof/${pid}`, { method: "POST", body: fd });
    }, rewardPayment.id);

    // Admin confirm should trigger referral reward 5 credits for Pro
    await login(page, referrerEmail);
    const beforeRewardStats = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      const data = (await r.json()) as { credits_earned: number; invited_count: number };
      return data;
    });
    const beforeCredits = beforeRewardStats.credits_earned;

    const rewardConfirm = await page.evaluate(async (pid: string) => {
      const r = await fetch(`/api/eft/admin/${pid}/confirm`, { method: "POST" });
      return { ok: r.ok, status: r.status };
    }, rewardPayment.id);
    expect(rewardConfirm.ok).toBe(true);

    const afterRewardStats = await page.evaluate(async () => {
      const r = await fetch("/api/referrals/my");
      const data = (await r.json()) as { credits_earned: number; subscribed_count: number };
      return data;
    });
    expect(afterRewardStats.credits_earned).toBe(beforeCredits + 5);
    expect(afterRewardStats.subscribed_count).toBeGreaterThanOrEqual(1);

    // Auditable via referral_rewards D1 state - check activity feed contains referral_reward
    const activity = await page.evaluate(async () => {
      const r = await fetch("/api/dashboard/activity?type=referral_reward");
      return (await r.json()) as { items: Array<{ type: string; credits_granted: number }> };
    });
    expect(
      activity.items.some((i) => i.type === "referral_reward" && i.credits_granted === 5),
    ).toBe(true);
  });

  test("admin consoles have no accessibility violations", async ({ page, browser }) => {
    test.setTimeout(120000);
    // Signup + promotion in a throwaway context so the login below starts
    // from a fresh, unauthenticated /login — no SPA navigation races.
    const throwaway = await browser.newContext();
    const tp = await throwaway.newPage();
    const email = await signUpWithCompany(tp, "Admin A11y", FIXTURE_COMPANY);
    promoteLocalUserToAdmin(email);
    await throwaway.close();
    await login(page, email);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    for (const path of ["/admin", "/admin/users", "/admin/companies", "/admin/eft"]) {
      await page.goto(path);
      await expect(page.getByTestId("admin-nav")).toBeVisible({ timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page, path);
    }
  });
});
