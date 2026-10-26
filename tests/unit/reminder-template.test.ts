import { describe, expect, it } from "vitest";

import {
  buildEmailHtml,
  buildPasswordResetHtml,
  buildTestAlertHtml,
  subjectSuffix,
} from "@/lib/reminder-template";

const BASE = {
  companyName: "Amandla Construction",
  docType: "TAX_PIN",
  docFile: "tcs-pin.pdf",
  expiryDateIso: "2026-02-09",
  appUrl: "https://vektorhq.co.za",
};

describe("reminder subject lines", () => {
  it("suffixes the 7-day subject with the renewal window", () => {
    expect(subjectSuffix(7)).toContain("7 days to renew");
    expect(`[Vektor] Tax Clearance PIN · ${subjectSuffix(7)}`).toBe(
      "[Vektor] Tax Clearance PIN · URGENT — 7 days to renew",
    );
  });

  it("marks the expiry-day subject as ineligible", () => {
    expect(subjectSuffix(0)).toBe("EXPIRED — Ineligible to Bid");
  });

  it("labels the 30-day subject as a renewal reminder", () => {
    expect(subjectSuffix(30)).toBe("Renewal reminder — 30 days");
  });
});

describe("reminder body", () => {
  it("badges the 7-day email urgent with the amber accent", () => {
    const html = buildEmailHtml({ ...BASE, threshold: 7 });
    expect(html).toContain("URGENT — 7 DAYS TO EXPIRY");
    expect(html).toContain("#D97706");
    expect(html).toContain("Amandla Construction");
  });

  it("badges the expiry-day email ineligible with the danger accent", () => {
    const html = buildEmailHtml({ ...BASE, threshold: 0 });
    expect(html).toContain("EXPIRED TODAY — INELIGIBLE TO BID");
    expect(html).toContain("#DC2626");
  });

  it("badges the 30-day email with the neutral accent", () => {
    const html = buildEmailHtml({ ...BASE, threshold: 30 });
    expect(html).toContain("30 DAYS TO EXPIRY");
  });

  it("links back to the vault", () => {
    const html = buildEmailHtml({ ...BASE, threshold: 7 });
    expect(html).toContain("https://vektorhq.co.za/documents");
  });
});

describe("test alert and reset templates", () => {
  it("names the company in the test alert", () => {
    const html = buildTestAlertHtml({
      companyName: "Amandla Construction",
      appUrl: "https://vektorhq.co.za",
    });
    expect(html).toContain("Test alert");
    expect(html).toContain("Amandla Construction");
  });

  it("embeds the reset url in the password email", () => {
    const url = "https://vektorhq.co.za/api/auth/reset-password/abc123";
    const html = buildPasswordResetHtml({ url, appUrl: "https://vektorhq.co.za" });
    expect(html).toContain(url);
  });
});
