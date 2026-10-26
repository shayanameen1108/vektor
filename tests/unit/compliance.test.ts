import { describe, expect, it } from "vitest";

import { isBargainingCouncilCovered } from "@/lib/compliance";

describe("bargaining council document coverage", () => {
  const now = new Date("2026-08-24T12:00:00Z");

  it("accepts a current compliant tagged letter for an applicable council", () => {
    expect(
      isBargainingCouncilCovered(
        ["BCCEI"],
        [
          {
            bargainingCouncil: "BCCEI",
            isCompliant: true,
            expiryDate: "2026-12-31T00:00:00Z",
          },
        ],
        now,
      ),
    ).toBe(true);
  });

  it("rejects mismatched, non-compliant, and expired tagged letters", () => {
    expect(
      isBargainingCouncilCovered(
        ["BCCEI"],
        [{ bargainingCouncil: "NBCEI", isCompliant: true }],
        now,
      ),
    ).toBe(false);
    expect(
      isBargainingCouncilCovered(
        ["BCCEI"],
        [{ bargainingCouncil: "BCCEI", isCompliant: false }],
        now,
      ),
    ).toBe(false);
    expect(
      isBargainingCouncilCovered(
        ["BCCEI"],
        [
          {
            bargainingCouncil: "BCCEI",
            isCompliant: true,
            expiryDate: "2026-08-23T00:00:00Z",
          },
        ],
        now,
      ),
    ).toBe(false);
  });

  it("preserves legacy untagged current-letter coverage", () => {
    expect(
      isBargainingCouncilCovered(
        ["BIBC_WC", "BIBC_SEC"],
        [
          {
            bargainingCouncil: null,
            isCompliant: true,
            expiryDate: "2027-01-01T00:00:00Z",
          },
        ],
        now,
      ),
    ).toBe(true);
  });
});
