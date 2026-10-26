import { describe, expect, it } from "vitest";

import { classifyExpiry, EXPIRING_SOON_DAYS, extractExpiryFromText } from "@/lib/compliance";
import { REMINDER_THRESHOLDS } from "@/lib/reminder";

/**
 * Expiry coverage for spec story 11 (extracted printed expiry drives when
 * reminder emails fire) and the amber dashboard banner window.
 *
 * The document bodies below are the literal text `unpdf` returns for the
 * committed fixtures in tests/fixtures, so the regex is pinned against the
 * same characters the Worker sees on upload.
 */
const FIXTURE_TEXT = {
  taxPin:
    "SOUTH AFRICAN REVENUE SERVICE\nTax Compliance Status — PIN Certificate\nThis certificate is valid until 2027-01-15.",
  bbbee:
    "B-BBEE STATUS LEVEL VERIFICATION CERTIFICATE\nEntity: Example Construction (Pty) Ltd\nB-BBEE Status Level: 2 Contributor\nCertificate expiry date: 2026-12-31",
  bccei:
    "BARGAINING COUNCIL FOR THE CIVIL ENGINEERING INDUSTRY\nLetter of Good Standing — BCCEI\nThis letter is valid until 2027-12-31.",
  bcceiRenewed:
    "BARGAINING COUNCIL FOR THE CIVIL ENGINEERING INDUSTRY\nLetter of Good Standing — BCCEI (renewed)\nThis letter is valid until 2028-06-01.",
  nbcei:
    "NATIONAL BARGAINING COUNCIL FOR THE ELECTRICAL INDUSTRY\nLetter of Good Standing — NBCEI\nThis letter is valid until 2028-01-01.",
  tender:
    "CITY OF TSHWANE METROPOLITAN MUNICIPALITY\nINVITATION TO BID: MUN/2024/INFRA-045\nBid description: Supply and Delivery of Electrical Components\nfor Municipal Infrastructure programmes.\nTender required CIDB 4EB or higher.\nA compulsory clarification meeting will be held on site.\nClosing date: 2025-03-15 at 11:00.",
} as const;

describe("expiry date extraction from document text", () => {
  it.each([
    ["SARS tax compliance PIN", FIXTURE_TEXT.taxPin, "2027-01-15"],
    ["B-BBEE certificate", FIXTURE_TEXT.bbbee, "2026-12-31"],
    ["BCCEI letter", FIXTURE_TEXT.bccei, "2027-12-31"],
    ["renewed BCCEI letter", FIXTURE_TEXT.bcceiRenewed, "2028-06-01"],
    ["NBCEI letter", FIXTURE_TEXT.nbcei, "2028-01-01"],
  ])("reads the printed expiry of the %s fixture", (_name, text, expected) => {
    expect(extractExpiryFromText(text)).toBe(expected);
  });

  it("never mistakes a tender closing date for a document expiry", () => {
    expect(extractExpiryFromText(FIXTURE_TEXT.tender)).toBeNull();
    expect(extractExpiryFromText("Closing date: 2025-03-15 at 11:00.")).toBeNull();
  });

  it.each([
    ["valid until", "This letter is valid until 2027-01-15."],
    ["valid to", "This letter is valid to 2027-01-15."],
    ["valid till", "This letter is valid till 2027-01-15."],
    ["valid through", "This letter is valid through 2027-01-15."],
    ["date of expiry", "Date of expiry: 2027-01-15"],
    ["expiry date", "Certificate expiry date: 2027-01-15"],
    ["expires on", "This certificate expires on 2027-01-15."],
    ["expires", "This certificate expires 2027-01-15."],
    ["certificate valid", "Certificate valid 2027-01-15."],
    ["certificate expiry", "Certificate expiry 2027-01-15."],
    ["validity", "Validity: 2027-01-15"],
    ["validity period", "Validity period: 2027-01-15"],
    ["validity expires", "Validity expires 2027-01-15"],
  ])("accepts the %s anchor wording", (_name, text) => {
    expect(extractExpiryFromText(text)).toBe("2027-01-15");
  });

  it.each([
    ["ISO with hyphens", "valid until 2027-01-15"],
    ["ISO with slashes", "valid until 2027/01/15"],
    ["ISO with dots", "valid until 2027.01.15"],
    ["ISO with spaces", "valid until 2027 01 15"],
    ["day/month/year", "valid until 15/01/2027"],
    ["day-month-year", "valid until 15-01-2027"],
    ["day.month.year", "valid until 15.01.2027"],
    ["day month year", "valid until 15 01 2027"],
    ["day monthname year", "valid until 15 January 2027"],
    ["day abbreviated month", "valid until 15 Jan 2027"],
    ["monthname day year", "valid until January 15, 2027"],
    ["abbreviated month day year", "valid until Jan 15 2027"],
  ] as const)("parses %s", (_name, text) => {
    expect(extractExpiryFromText(text)).toBe("2027-01-15");
  });

  it("normalises to a zero-padded calendar date", () => {
    expect(extractExpiryFromText("expiry date 2027-1-5")).toBe("2027-01-05");
    expect(extractExpiryFromText("expiry date 1/5/2027")).toBe("2027-05-01");
  });

  it("resolves a two-digit-first date as day/month/year", () => {
    expect(extractExpiryFromText("valid until 03/04/2027")).toBe("2027-04-03");
  });

  it("drops a time or timestamp trailing the date", () => {
    expect(extractExpiryFromText("expiry date 2027-01-15T00:00:00")).toBe("2027-01-15");
    expect(extractExpiryFromText("expiry date 2027-01-15 11:00")).toBe("2027-01-15");
  });

  it("tolerates punctuation, spacing and casing between the anchor and the date", () => {
    expect(extractExpiryFromText("VALID UNTIL 2027-01-15")).toBe("2027-01-15");
    expect(extractExpiryFromText("Date of expiry:  2027-01-15")).toBe("2027-01-15");
    expect(extractExpiryFromText("valid until - 2027-01-15")).toBe("2027-01-15");
  });

  it("returns the first anchored date when a letter states several", () => {
    expect(
      extractExpiryFromText(
        "Original letter valid until 2027-12-31.\nRenewal letter valid until 2028-12-31.",
      ),
    ).toBe("2027-12-31");
  });

  it("keeps scanning past a candidate it cannot parse", () => {
    expect(
      extractExpiryFromText(
        "This letter is valid until 2027-13-31.\nRenewal valid until 2028-12-31.",
      ),
    ).toBe("2028-12-31");
    expect(extractExpiryFromText("Validity period ends 2027-01-15\nExpiry date: 2027-06-30")).toBe(
      "2027-06-30",
    );
  });

  it("skips a numeric distractor that is not a date", () => {
    expect(extractExpiryFromText("Validity period: 36 months. Expiry date: 2027-01-15")).toBe(
      "2027-01-15",
    );
  });

  it.each([
    ["an empty document body", ""],
    ["text with no date at all", "SOUTH AFRICAN REVENUE SERVICE\nTax Compliance Status"],
    ["a date with no expiry anchor", "The certificate is dated 2027-01-15"],
    ["the bare label Expiry:", "Expiry: 2027-01-15"],
    ["a two-digit year", "valid until 15/01/27"],
    ["month 13", "valid until 2027-13-01"],
    ["month 0", "valid until 2027-00-15"],
    ["day 45", "valid until 2027-01-45"],
    ["31 February", "valid until 31 February 2027"],
    ["29 February in a non-leap year", "valid until 2027-02-29"],
    ["a spelled-out non-date", "valid until abcdefg"],
  ] as const)("finds no expiry in %s", (_name, text) => {
    expect(extractExpiryFromText(text)).toBeNull();
  });

  it("accepts any calendar-valid year without a plausibility window", () => {
    expect(extractExpiryFromText("valid until 1970-01-01")).toBe("1970-01-01");
    expect(extractExpiryFromText("valid until 2099-12-31")).toBe("2099-12-31");
    expect(extractExpiryFromText("valid until 2028-02-29")).toBe("2028-02-29");
  });

  it("gives the same answer on repeated calls over the same and differing inputs", () => {
    const single = "This letter is valid until 2027-12-31.";
    const multi = "valid until 2027-12-31 and valid until 2028-06-01";
    const miss = "no dates anywhere here";
    for (let i = 0; i < 5; i++) {
      expect(extractExpiryFromText(miss)).toBeNull();
      expect(extractExpiryFromText(single)).toBe("2027-12-31");
      expect(extractExpiryFromText(multi)).toBe("2027-12-31");
      expect(extractExpiryFromText(single)).toBe("2027-12-31");
    }
  });
});

describe("expiry classification for the vault and dashboard banner", () => {
  const DAY = 86_400_000;
  const nowMs = Date.UTC(2026, 7, 24, 12);

  it("publishes a 30-day window matching the widest reminder threshold", () => {
    expect(EXPIRING_SOON_DAYS).toBe(30);
    expect(EXPIRING_SOON_DAYS).toBe(Math.max(...REMINDER_THRESHOLDS));
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["an unparseable value", "not-a-date"],
  ] as const)("reports %s as having no expiry to classify", (_name, value) => {
    expect(classifyExpiry(value, nowMs)).toBe("none");
  });

  it("marks anything before the anchor instant expired", () => {
    expect(classifyExpiry(new Date(nowMs - DAY).toISOString(), nowMs)).toBe("expired");
    expect(classifyExpiry(new Date(nowMs - 1).toISOString(), nowMs)).toBe("expired");
  });

  it("treats the exact expiry instant as due rather than already expired", () => {
    expect(classifyExpiry(new Date(nowMs).toISOString(), nowMs)).toBe("expiring_soon");
  });

  it("holds the due-soon band all the way up to the boundary", () => {
    expect(classifyExpiry(new Date(nowMs + DAY).toISOString(), nowMs)).toBe("expiring_soon");
    expect(classifyExpiry(new Date(nowMs + 29 * DAY).toISOString(), nowMs)).toBe("expiring_soon");
    expect(classifyExpiry(new Date(nowMs + 30 * DAY - 1).toISOString(), nowMs)).toBe(
      "expiring_soon",
    );
  });

  it("leaves the due-soon band at exactly 30 days out", () => {
    expect(classifyExpiry(new Date(nowMs + 30 * DAY).toISOString(), nowMs)).toBe("ok");
    expect(classifyExpiry(new Date(nowMs + 30 * DAY + 1).toISOString(), nowMs)).toBe("ok");
    expect(classifyExpiry(new Date(nowMs + 31 * DAY).toISOString(), nowMs)).toBe("ok");
  });

  it("anchors a bare calendar date at UTC midnight", () => {
    const expiry = "2026-09-23";
    expect(classifyExpiry(expiry, Date.UTC(2026, 8, 22))).toBe("expiring_soon");
    expect(classifyExpiry(expiry, Date.UTC(2026, 8, 23))).toBe("expiring_soon");
    expect(classifyExpiry(expiry, Date.UTC(2026, 8, 23, 1))).toBe("expired");
    expect(classifyExpiry(expiry, Date.UTC(2026, 7, 24))).toBe("ok");
    expect(classifyExpiry(expiry, Date.UTC(2026, 7, 24, 1))).toBe("expiring_soon");
  });
});
