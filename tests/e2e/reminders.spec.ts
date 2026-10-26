import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  daysFromNow,
  login,
  pickDate,
  RESEND_TEST_INBOX,
  signUp,
  signUpWithCompany,
} from "./helpers";
import { promoteLocalUserToAdmin } from "./local-admin";
import { makePdf } from "./fixtures";

/** A signed-in admin in its own context — POST /api/reminders/sweep is admin-only. */
async function createLocalAdmin(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = await signUp(page, "Reminder Admin");
  promoteLocalUserToAdmin(email);
  await login(page, email);
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  return { context, page };
}

test.describe.serial("Reminders and Cron (Resend + sent_reminders)", () => {
  test("7-day expiry triggers one email, second sweep does not duplicate", async ({
    page,
    browser,
  }) => {
    await signUpWithCompany(page, "Reminder Test User", {
      companyName: "Reminder Test Pty Ltd",
      contactEmail: RESEND_TEST_INBOX,
      cidb: "4GB, 6CE",
      bbbeeLevel: "1",
    });
    // The sweep attributes reminders by company id, so this journey needs its
    // company to be the only one on the account.
    const response = await page.request.get("/api/companies");
    expect(response.ok()).toBe(true);
    const companies = (await response.json()) as Array<{ id: string }>;
    expect(companies).toHaveLength(1);
    const companyId = companies[0]!.id;

    const admin = await createLocalAdmin(browser);

    // Go to documents and upload a doc with expiry 7 days from now
    await page.goto("/documents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 10000 });

    const expiry7 = daysFromNow(7);

    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Tax Clearance PIN/i }).click();
    await pickDate(page, "input-expiry-date", expiry7);

    await page
      .getByTestId("input-file-upload")
      .setInputFiles(await makePdf("tax-7days.pdf", [`Valid until ${expiry7}.`]));

    // Wait for preview hint but not required for upload
    await page.getByTestId("add-document-btn").click();

    const row = page.locator('[data-testid^="doc-row-"]');
    await expect(row.first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("documents-list-card")).toContainText("tax-7days.pdf");

    const sweepResponses = await Promise.all([
      admin.page.request.post("/api/reminders/sweep"),
      admin.page.request.post("/api/reminders/sweep"),
    ]);
    expect(sweepResponses.every((response) => response.ok())).toBe(true);
    const sweepResults = await Promise.all(sweepResponses.map((response) => response.json()));
    const ourConcurrentDetails = sweepResults.flatMap(
      (result) => (result.details ?? []) as Array<Record<string, unknown>>,
    );
    const ourSent1 = ourConcurrentDetails.filter(
      (detail) =>
        detail.companyId === companyId && detail.threshold === 7 && detail.status === "sent",
    );
    expect(ourSent1).toHaveLength(1);
    // Email subject/body content is covered by tests/unit/reminder-template.test.ts;
    // the sweep details above prove exactly one send was issued for this company.

    const sweep2 = await admin.page.request.post("/api/reminders/sweep");
    expect(sweep2.ok()).toBeTruthy();
    const sweep2Json = await sweep2.json();
    const details2 = (sweep2Json.details ?? []) as Array<Record<string, unknown>>;
    expect(
      details2.filter(
        (detail) =>
          detail.companyId === companyId && detail.threshold === 7 && detail.status === "sent",
      ),
    ).toHaveLength(0);

    // Deleting the document removes its reminder claim and the document from future sweeps.
    const documentsResponse = await page.request.get(`/api/documents/company/${companyId}`);
    expect(documentsResponse.ok()).toBe(true);
    const currentDocuments = (await documentsResponse.json()) as Array<{ id: string }>;
    expect(currentDocuments).toHaveLength(1);
    const deleteResponse = await page.request.delete(`/api/documents/${currentDocuments[0]!.id}`);
    expect(deleteResponse.ok()).toBe(true);

    const sweepAfterDelete = await admin.page.request.post("/api/reminders/sweep");
    expect(sweepAfterDelete.ok()).toBe(true);
    const sweepAfterJson = await sweepAfterDelete.json();
    expect(sweepAfterJson.sent).toBe(0);

    // Non-compliant docs should not trigger — upload a non-compliant doc with 7-day expiry
    await page.goto("/documents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /COIDA/ }).click();
    await pickDate(page, "input-expiry-date", daysFromNow(7));
    // Set to Non-Compliant via select
    await page.getByTestId("select-compliance-status").click();
    await page.getByRole("option", { name: /Non-Compliant/ }).click();
    await page
      .getByTestId("input-file-upload")
      .setInputFiles(await makePdf("coida-noncompliant.pdf", [`Valid until ${daysFromNow(7)}.`]));
    await page.getByTestId("add-document-btn").click();
    await expect(page.getByText("coida-noncompliant.pdf")).toBeVisible({ timeout: 8000 });

    const sweepNonCompliant = await admin.page.request.post("/api/reminders/sweep");
    const sweepNonJson = await sweepNonCompliant.json();
    // Should be 0 sent because non-compliant skipped
    expect(sweepNonJson.sent).toBe(0);
    await admin.context.close();
  });

  test("threshold 0 reports an expiry-day send", async ({ page, browser }) => {
    await signUpWithCompany(page, "Reminder Test User", {
      companyName: "Reminder Test Pty Ltd",
      contactEmail: RESEND_TEST_INBOX,
      cidb: "4GB, 6CE",
      bbbeeLevel: "1",
    });
    const companiesRes = await page.request.get("/api/companies");
    const companyId = ((await companiesRes.json()) as Array<{ id: string }>)[0]!.id;
    const admin = await createLocalAdmin(browser);

    await page.goto("/documents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 10000 });

    const expiry0 = daysFromNow(0);

    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /B-BBEE/ }).click();
    await pickDate(page, "input-expiry-date", expiry0);
    await page
      .getByTestId("input-file-upload")
      .setInputFiles(await makePdf("bbbee-expired.pdf", [`Valid until ${expiry0}.`]));
    await page.getByTestId("add-document-btn").click();
    await expect(page.getByText("bbbee-expired.pdf")).toBeVisible({ timeout: 8000 });

    const sweep = await admin.page.request.post("/api/reminders/sweep");
    expect(sweep.ok()).toBeTruthy();
    const details = (((await sweep.json()) as { details?: unknown }).details ?? []) as Array<
      Record<string, unknown>
    >;
    // The expiry-day template content (banner, accent) is covered by
    // tests/unit/reminder-template.test.ts; here we prove the send fired.
    expect(
      details.filter(
        (detail) =>
          detail.companyId === companyId && detail.threshold === 0 && detail.status === "sent",
      ),
    ).toHaveLength(1);
    await admin.context.close();
  });

  test("company test alert sends one email to the contact and rejects foreign companies", async ({
    page,
  }) => {
    await signUpWithCompany(page, "Test Alert Contractor", {
      companyName: "Test Alert Pty Ltd",
      contactEmail: RESEND_TEST_INBOX,
    });
    const companies = (await (await page.request.get("/api/companies")).json()) as Array<{
      id: string;
    }>;
    expect(companies).toHaveLength(1);

    const response = await page.request.post(`/api/reminders/test/${companies[0]!.id}`);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { status?: string; to?: string; resendId?: string };
    expect(body.status).toBe("sent");
    expect((body.to ?? "").toLowerCase()).toBe(RESEND_TEST_INBOX);
    // resendId is a real Resend message id now — the send went out.
    expect(body.resendId).toBeTruthy();

    // A random id is indistinguishable from a missing company (no enumeration).
    const foreign = await page.request.post("/api/reminders/test/does-not-exist");
    expect(foreign.status()).toBe(404);
  });
});
