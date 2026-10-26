import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, pickDate, signUpWithCompany } from "./helpers";
import { pdfFixture } from "./fixtures";

test.describe("Compliance Document Vault", () => {
  test("upload → expiry warning → bargaining tag → delete", async ({ page }) => {
    // CIDB and B-BBEE cover the checks further down this journey.
    await signUpWithCompany(page, "Test Vault User", {
      companyName: "Vault Test Pty Ltd",
      cidb: "4GB, 6CE",
      bbbeeLevel: "1",
    });

    // Go to documents vault
    await page.goto("/documents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("add-document-card")).toBeVisible();
    await expect(page.getByTestId("documents-list-card")).toBeVisible();

    // Initially empty
    await expect(page.getByTestId("empty-docs")).toBeVisible();

    // Certificate extraction is advisory: an unreadable PDF previews as empty
    // and still stores successfully instead of blocking the vault workflow.
    const companyId = await page.evaluate(async () => {
      const companies = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
      return companies[0]!.id;
    });
    const unreadablePdf = {
      name: "unreadable.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-not-a-parseable-document"),
    };

    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /B-BBEE Certificate/ }).click();
    await page.getByTestId("input-file-upload").setInputFiles(unreadablePdf);
    await expect(page.getByTestId("bbbee-preview-empty")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("bbbee-preview-loading")).toBeHidden();
    await page.getByTestId("remove-upload-file").click();

    await page.route("**/api/documents/preview-bbbee", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );
    await page.getByTestId("input-file-upload").setInputFiles(unreadablePdf);
    await expect(page.getByTestId("bbbee-preview-error")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("bbbee-preview-loading")).toBeHidden();
    await page.getByTestId("remove-upload-file").click();
    await page.unroute("**/api/documents/preview-bbbee");

    const preview = await page.request.post("/api/documents/preview-bbbee", {
      multipart: { file: unreadablePdf, doc_type: "BBBEE" },
    });
    expect(preview.ok()).toBe(true);
    expect(await preview.json()).toEqual({
      extracted_bbbee_level: null,
      extracted_expiry_date: null,
    });
    const advisoryUpload = await page.request.post("/api/documents/upload", {
      multipart: {
        file: unreadablePdf,
        company_id: companyId,
        doc_type: "BBBEE",
        expiry_date: "2027-12-31",
        is_compliant: "true",
      },
    });
    expect(advisoryUpload.status()).toBe(201);
    const advisoryDocument = (await advisoryUpload.json()) as { id: string };
    expect((await page.request.delete(`/api/documents/${advisoryDocument.id}`)).ok()).toBe(true);

    // --- Upload TAX_PIN with mismatched expiry vs extracted ---
    // Select doc type TAX_PIN
    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Tax Clearance PIN/i }).click();
    await expect(page.getByTestId("link-sars-tcs-portal")).toBeVisible();

    // Typed expiry: 2026-12-31, but PDF will claim 2027-01-15 -> mismatch warning expected
    await pickDate(page, "input-expiry-date", "2026-12-31");

    await page.getByTestId("input-file-upload").setInputFiles(pdfFixture("cert-tax-pin.pdf"));

    // Preview hint should appear with detected expiry and offer Use this date
    await expect(page.getByTestId("bbbee-preview-hint")).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId("bbbee-preview-expiry")).toContainText("15 Jan 2027");
    // Don't use autofill — keep mismatch to test warning on upload

    await page.getByTestId("add-document-btn").click();

    // Should show toast for mismatch? Wait for row to appear
    const taxRow = page.locator('[data-testid^="doc-row-"]');
    await expect(taxRow.first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("documents-list-card")).toContainText("Tax Clearance PIN");
    await expect(page.getByTestId("documents-list-card")).toContainText("tax-pin.pdf");

    // Expiry mismatch badge should be visible for this doc
    const mismatchBadge = page.locator('[data-testid^="doc-expiry-mismatch-"]');
    await expect(mismatchBadge.first()).toBeVisible({ timeout: 5000 });
    await expect(mismatchBadge.first()).toContainText("Cert:");

    // Edit the doc to fix expiry via edit dialog
    const editBtn = page.locator('[data-testid^="edit-doc-"]').first();
    await editBtn.click();
    await expect(page.getByTestId("edit-doc-dialog")).toBeVisible();
    await pickDate(page, "edit-expiry-date", "2027-01-15");
    await page.getByTestId("edit-doc-save").click();
    await expect(page.getByTestId("edit-doc-dialog")).toBeHidden({ timeout: 5000 });
    // After fix, mismatch badge should disappear
    await expect(mismatchBadge).toHaveCount(0, { timeout: 5000 });

    // --- Upload BARGAINING_COUNCIL_GOS with council tag ---
    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Bargaining Council/ }).click();
    await expect(page.getByTestId("bc-picker-wrapper")).toBeVisible();
    await page.getByTestId("select-bargaining-council").click();
    await page.getByRole("option", { name: /BCCEI/ }).first().click();

    await pickDate(page, "input-expiry-date", "2027-12-31");
    await page.getByTestId("input-file-upload").setInputFiles(pdfFixture("cert-bccei.pdf"));
    await page.getByTestId("add-document-btn").click();
    await expect(page.getByText("bccei.pdf")).toBeVisible({ timeout: 8000 });
    // Council tag should be visible
    const councilTag = page.locator('[data-testid^="doc-council-"]').first();
    await expect(councilTag).toContainText("BCCEI");

    // Upload another BC letter for different council should NOT delete the first (scoped purge)
    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Bargaining Council/ }).click();
    await page.getByTestId("select-bargaining-council").click();
    await page.getByRole("option", { name: /NBCEI/ }).first().click();
    await pickDate(page, "input-expiry-date", "2028-01-01");
    await page.getByTestId("input-file-upload").setInputFiles(pdfFixture("cert-nbcei.pdf"));
    await page.getByTestId("add-document-btn").click();
    await expect(page.getByText("nbcei.pdf")).toBeVisible({ timeout: 8000 });
    // Both BCCEI and NBCEI should be present
    await expect(page.getByText("bccei.pdf")).toBeVisible();
    const allCouncilTags = page.locator('[data-testid^="doc-council-"]');
    await expect(allCouncilTags).toHaveCount(2);
    await expect(page.getByText("BCCEI").first()).toBeVisible();
    await expect(page.getByText("NBCEI").first()).toBeVisible();

    // Re-upload BCCEI should replace only BCCEI letter, NBCEI should remain
    await page.getByTestId("select-doc-type").click();
    await page.getByRole("option", { name: /Bargaining Council/ }).click();
    await page.getByTestId("select-bargaining-council").click();
    await page.getByRole("option", { name: /BCCEI/ }).first().click();
    await pickDate(page, "input-expiry-date", "2028-06-01");
    await page.getByTestId("input-file-upload").setInputFiles(pdfFixture("cert-bccei-v2.pdf"));
    await page.getByTestId("add-document-btn").click();
    await expect(page.getByText("bccei-v2.pdf")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("bccei.pdf")).toBeHidden();
    await expect(allCouncilTags).toHaveCount(2);
    await expect(page.getByText("nbcei.pdf")).toBeVisible();

    const replacement = await page.evaluate(async () => {
      const companies = (await (await fetch("/api/companies")).json()) as Array<{ id: string }>;
      const response = await fetch(`/api/documents/company/${companies[0]!.id}`);
      const documents = (await response.json()) as Array<{
        id: string;
        file_name: string;
        bargaining_council: string | null;
      }>;
      return documents.find(
        (document) =>
          document.file_name === "cert-bccei-v2.pdf" && document.bargaining_council === "BCCEI",
      );
    });
    expect(replacement?.id).toBeTruthy();
    const replacementDownload = await page.request.get(
      `/api/documents/download/${replacement!.id}`,
    );
    expect(replacementDownload.status()).toBe(200);
    expect(replacementDownload.headers()["content-type"]).toContain("application/pdf");
    expect(replacementDownload.headers()["content-disposition"]).toContain(
      'filename="cert-bccei-v2.pdf"',
    );
    expect(
      Buffer.compare(await replacementDownload.body(), pdfFixture("cert-bccei-v2.pdf").buffer),
    ).toBe(0);
    const replacementRange = await page.request.get(`/api/documents/download/${replacement!.id}`, {
      headers: { Range: "bytes=0-4" },
    });
    expect(replacementRange.status()).toBe(206);
    expect((await replacementRange.body()).toString()).toBe("%PDF-");

    // --- Delete flow ---
    // Delete the TAX PIN doc (first doc row before BC ones? find by file name)
    // Locate delete button for tax-pin.pdf row
    const taxDeleteBtn = page.locator('[data-testid^="delete-doc-"]').first();
    // Need to ensure we target correct doc: find row containing tax-pin.pdf then its delete
    // Simpler: count docs before delete
    const rowsBefore = await page.locator('[data-testid^="doc-row-"]').count();
    await taxDeleteBtn.click();
    await expect(page.getByTestId("delete-doc-dialog")).toBeVisible();
    await page.getByTestId("delete-doc-confirm").click();
    // Dialog should close and row count decrease
    await expect(page.getByTestId("delete-doc-dialog")).toBeHidden({ timeout: 5000 });
    const rowsAfter = await page.locator('[data-testid^="doc-row-"]').count();
    expect(rowsAfter).toBe(rowsBefore - 1);
  });

  test("document vault has no accessibility violations", async ({ page }) => {
    await signUpWithCompany(page, "A11y User", {
      companyName: "A11y Pty Ltd",
      cipc: "2020/123456/07",
    });
    await page.goto("/documents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("vault-title")).toBeVisible({ timeout: 10000 });
    await expectNoA11yViolations(page, "/documents");
  });
});
