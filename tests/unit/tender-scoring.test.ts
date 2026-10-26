import { describe, expect, it } from "vitest";

import { scoreTender, verdictFromScore, VERDICT_META } from "@/lib/tender-scoring";

/**
 * Risk flag scoring and verdict thresholds (spec story 17): Tax –50,
 * COIDA –30, CIDB –20, Bargaining Council uncovered -> WARNING only.
 */

type TenderFactsInput = Parameters<typeof scoreTender>[0];
type CompanyInput = Parameters<typeof scoreTender>[1];
type VaultDocInput = Parameters<typeof scoreTender>[2][number];

const now = new Date("2026-08-24T12:00:00Z");
const current = "2027-01-15T00:00:00Z";
const lapsed = "2026-08-23T00:00:00Z";

const TAX_FLAG =
  "CRITICAL: SARS TCS Pin is non-compliant or missing. Immediate disqualification risk.";
const COIDA_FLAG = "CRITICAL: COIDA Letter of Good Standing is expired or missing.";

function facts(overrides: Partial<TenderFactsInput> = {}): TenderFactsInput {
  return {
    tender_title: "Supply and Delivery of Electrical Components",
    tender_number: "MUN/2024/INFRA-045",
    issuing_entity: "City of Tshwane Metropolitan Municipality",
    required_cidb: null,
    closing_date: "2025-03-15",
    mandatory_returnables: ["Tax PIN", "COIDA"],
    ...overrides,
  };
}

function company(overrides: Partial<CompanyInput> = {}): CompanyInput {
  return { bbbeeLevel: null, cidbCrsNum: null, bargainingCouncils: [], ...overrides };
}

function doc(docType: string, overrides: Partial<VaultDocInput> = {}): VaultDocInput {
  return { docType, isCompliant: true, bargainingCouncil: null, ...overrides };
}

/** A vault that loses nothing: current, compliant, and council-covered. */
function cleanVault(): VaultDocInput[] {
  return [
    doc("TAX_PIN", { expiryDate: current }),
    doc("COIDA", { expiryDate: current }),
    doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "BCCEI", expiryDate: current }),
  ];
}

describe("tender risk flag scoring", () => {
  it("awards a fully compliant profile the full fit score with no risk flags", () => {
    expect(scoreTender(facts(), company(), cleanVault(), "80/20", now)).toEqual({
      fitScore: 100,
      riskFlags: [],
      verdict: "GO",
      eligibleBbbeePoints: 0,
    });
  });

  describe("Tax –50", () => {
    it("deducts 50 for a flagged non-compliant TCS PIN", () => {
      const result = scoreTender(
        facts(),
        company(),
        [doc("TAX_PIN", { isCompliant: false, expiryDate: current }), ...cleanVault().slice(1)],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(50);
      expect(result.riskFlags).toEqual([TAX_FLAG]);
      expect(result.verdict).toBe("CAUTION");
    });

    it("deducts 50 when no TCS PIN document exists at all", () => {
      const [, ...rest] = cleanVault();
      const result = scoreTender(facts(), company(), rest, "80/20", now);
      expect(result.fitScore).toBe(50);
      expect(result.riskFlags).toEqual([TAX_FLAG]);
    });

    it("deducts 50 when the tax clearance has lapsed", () => {
      const result = scoreTender(
        facts(),
        company(),
        [doc("TAX_PIN", { expiryDate: lapsed }), ...cleanVault().slice(1)],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(50);
      expect(result.riskFlags).toEqual([TAX_FLAG]);
    });

    it("counts a clearance expiring at exactly the scoring instant as still current", () => {
      const result = scoreTender(
        facts(),
        company(),
        [doc("TAX_PIN", { expiryDate: now.toISOString() }), ...cleanVault().slice(1)],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toEqual([]);
    });

    it("treats an unparseable tax expiry as non-compliant", () => {
      const result = scoreTender(
        facts(),
        company(),
        [doc("TAX_PIN", { expiryDate: "not-a-date" }), ...cleanVault().slice(1)],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(50);
      expect(result.riskFlags).toEqual([TAX_FLAG]);
    });

    it("treats a tax document with no expiry recorded as current", () => {
      const result = scoreTender(
        facts(),
        company(),
        [doc("TAX_PIN"), ...cleanVault().slice(1)],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toEqual([]);
    });

    it("deducts 50 once when only one of several tax documents fails", () => {
      const result = scoreTender(
        facts(),
        company(),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("TAX_PIN", { isCompliant: false }),
          ...cleanVault().slice(1),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(50);
      expect(result.riskFlags).toEqual([TAX_FLAG]);
    });
  });

  describe("COIDA –30", () => {
    it("deducts 30 for a missing Letter of Good Standing", () => {
      const result = scoreTender(
        facts(),
        company(),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "BCCEI", expiryDate: current }),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(70);
      expect(result.riskFlags).toEqual([COIDA_FLAG]);
      expect(result.verdict).toBe("CAUTION");
    });

    it("deducts 30 for an expired Letter of Good Standing", () => {
      const result = scoreTender(
        facts(),
        company(),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("COIDA", { expiryDate: lapsed }),
          doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "BCCEI", expiryDate: current }),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(70);
      expect(result.riskFlags).toEqual([COIDA_FLAG]);
    });
  });

  describe("CIDB –20", () => {
    it("deducts 20 when the highest registered grade is below the requirement", () => {
      const result = scoreTender(
        facts({ required_cidb: "6CE" }),
        company({ cidbCrsNum: "4CE" }),
        cleanVault(),
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(80);
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]).toContain("WARNING");
      expect(result.riskFlags[0]).toContain("6CE");
      expect(result.riskFlags[0]).toContain("4CE");
      expect(result.verdict).toBe("GO");
    });

    it("deducts 20 when no registered class overlaps the requirement", () => {
      const result = scoreTender(
        facts({ required_cidb: "4EB" }),
        company({ cidbCrsNum: "3GB" }),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("COIDA", { expiryDate: current }),
          doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "NBCEI", expiryDate: current }),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(80);
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]).toContain("CIDB class");
    });

    it("deducts nothing when a higher grade covers the requirement in the same class", () => {
      const result = scoreTender(
        facts({ required_cidb: "4EB" }),
        company({ cidbCrsNum: "6EB" }),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("COIDA", { expiryDate: current }),
          doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "NBCEI", expiryDate: current }),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toEqual([]);
    });

    it("warns without deducting when the profile carries no CIDB grade", () => {
      const result = scoreTender(
        facts({ required_cidb: "4EB" }),
        company(),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("COIDA", { expiryDate: current }),
          doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "NBCEI", expiryDate: current }),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]).toContain("WARNING");
      expect(result.riskFlags[0]).toContain("no CIDB grade");
    });

    it("raises no CIDB flag when the tender states no requirement", () => {
      const result = scoreTender(
        facts(),
        company({ cidbCrsNum: "1CE" }),
        cleanVault(),
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toEqual([]);
    });

    it("ignores a requirement it cannot parse", () => {
      const result = scoreTender(
        facts({ required_cidb: "Grade SA" }),
        company({ cidbCrsNum: "4EB" }),
        cleanVault(),
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toEqual([]);
    });
  });

  describe("deduction arithmetic and the 0-100 clamp", () => {
    function scoreDeductions(taxFails: boolean, coidaFails: boolean, cidbMismatch: boolean) {
      const docs: VaultDocInput[] = [
        doc("TAX_PIN", { isCompliant: !taxFails, expiryDate: current }),
        doc("COIDA", { isCompliant: true, expiryDate: coidaFails ? lapsed : current }),
        doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "BCCEI", expiryDate: current }),
      ];
      return scoreTender(
        facts(cidbMismatch ? { required_cidb: "6CE" } : {}),
        company(cidbMismatch ? { cidbCrsNum: "4CE" } : {}),
        docs,
        "80/20",
        now,
      );
    }

    it.each([
      ["everything compliant", false, false, false, 100, "GO", 0],
      ["Tax only", true, false, false, 50, "CAUTION", 1],
      ["COIDA only", false, true, false, 70, "CAUTION", 1],
      ["CIDB only", false, false, true, 80, "GO", 1],
      ["Tax and COIDA", true, true, false, 20, "NO-GO", 2],
      ["Tax and CIDB", true, false, true, 30, "NO-GO", 2],
      ["COIDA and CIDB", false, true, true, 50, "CAUTION", 2],
      ["Tax, COIDA and CIDB", true, true, true, 0, "NO-GO", 3],
    ] as const)(
      "%s lands on the summed deduction",
      (_name, tax, coida, cidb, expected, verdict, flags) => {
        const result = scoreDeductions(tax, coida, cidb);
        expect(result.fitScore).toBe(expected);
        expect(result.verdict).toBe(verdict);
        expect(result.riskFlags).toHaveLength(flags);
      },
    );

    it("keeps every reachable fit score inside 0-100", () => {
      for (const tax of [true, false]) {
        for (const coida of [true, false]) {
          for (const cidb of [true, false]) {
            const { fitScore } = scoreDeductions(tax, coida, cidb);
            expect(fitScore).toBeGreaterThanOrEqual(0);
            expect(fitScore).toBeLessThanOrEqual(100);
          }
        }
      }
    });

    it("reaches the 0 floor exactly on the worst legal combination", () => {
      const result = scoreDeductions(true, true, true);
      expect(result.fitScore).toBe(0);
      expect(result.riskFlags.filter((flag) => flag.startsWith("CRITICAL:"))).toHaveLength(2);
      expect(result.riskFlags.filter((flag) => flag.startsWith("WARNING:"))).toHaveLength(1);
    });

    it("reports the same verdict for the score it returns", () => {
      for (const tax of [true, false]) {
        for (const coida of [true, false]) {
          for (const cidb of [true, false]) {
            const result = scoreDeductions(tax, coida, cidb);
            expect(result.verdict).toBe(verdictFromScore(result.fitScore));
          }
        }
      }
    });
  });

  describe("bargaining council inference is a warning, never a deduction", () => {
    const NBCEI_NAME = "National Bargaining Council for the Electrical Industry of South Africa";

    function electricalTender(vaultDocs: VaultDocInput[]) {
      return scoreTender(
        facts({ required_cidb: "4EB" }),
        company({ cidbCrsNum: "4EB" }),
        [
          doc("TAX_PIN", { expiryDate: current }),
          doc("COIDA", { expiryDate: current }),
          ...vaultDocs,
        ],
        "80/20",
        now,
      );
    }

    it("leaves the fit score untouched when the applicable council is uncovered", () => {
      const result = electricalTender([]);
      expect(result.fitScore).toBe(100);
      expect(result.verdict).toBe("GO");
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]!.startsWith("WARNING:")).toBe(true);
      expect(result.riskFlags[0]).toContain(NBCEI_NAME);
    });

    it("costs nothing versus a covered council", () => {
      const uncovered = electricalTender([]);
      const covered = electricalTender([
        doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "NBCEI", expiryDate: current }),
      ]);
      expect(covered.riskFlags).toEqual([]);
      expect(covered.fitScore).toBe(uncovered.fitScore);
    });

    it("names every regional code when the tender falls under general building", () => {
      const result = scoreTender(
        facts({ required_cidb: "4GB" }),
        company({ cidbCrsNum: "4GB" }),
        [doc("TAX_PIN", { expiryDate: current }), doc("COIDA", { expiryDate: current })],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]).toContain("BIBC_WC / BIBC_SEC / BIBC_EL / BIBC_KIM / BCBI_BFN");
    });

    it("points at the registered councils list when the profile names other councils", () => {
      const result = scoreTender(
        facts({ required_cidb: "4EB" }),
        company({ cidbCrsNum: "4EB", bargainingCouncils: ["BCCEI"] }),
        [doc("TAX_PIN", { expiryDate: current }), doc("COIDA", { expiryDate: current })],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(100);
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]).toContain("not on your registered councils list");
    });

    it("points at the compliance vault when the profile names no councils", () => {
      const result = electricalTender([]);
      expect(result.riskFlags[0]).toContain("Compliance Vault");
    });

    it("accepts a legacy untagged letter as coverage", () => {
      const result = electricalTender([
        doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: null, expiryDate: current }),
      ]);
      expect(result.riskFlags).toEqual([]);
      expect(result.fitScore).toBe(100);
    });

    it("warns again when the only council letter has expired", () => {
      const result = electricalTender([
        doc("BARGAINING_COUNCIL_GOS", { bargainingCouncil: "NBCEI", expiryDate: lapsed }),
      ]);
      expect(result.riskFlags).toHaveLength(1);
      expect(result.riskFlags[0]).toContain(NBCEI_NAME);
      expect(result.fitScore).toBe(100);
    });

    it("skips the council check entirely when the CIDB class has no council", () => {
      const result = scoreTender(
        facts({ required_cidb: "4PC" }),
        company({ cidbCrsNum: "4PC" }),
        [doc("TAX_PIN", { expiryDate: current }), doc("COIDA", { expiryDate: current })],
        "80/20",
        now,
      );
      expect(result.riskFlags).toEqual([]);
      expect(result.fitScore).toBe(100);
    });

    it("stacks the council warning on top of the statutory deductions without changing the score", () => {
      const result = scoreTender(
        facts({ required_cidb: "6CE" }),
        company({ cidbCrsNum: "4CE" }),
        [
          doc("TAX_PIN", { isCompliant: false, expiryDate: current }),
          doc("COIDA", { expiryDate: lapsed }),
        ],
        "80/20",
        now,
      );
      expect(result.fitScore).toBe(0);
      expect(result.riskFlags).toHaveLength(4);
      expect(result.verdict).toBe("NO-GO");
    });
  });

  describe("B-BBEE preference system passthrough", () => {
    it("reports eligible points for the tender's preference system", () => {
      expect(
        scoreTender(facts(), company({ bbbeeLevel: 2 }), cleanVault(), "90/10", now)
          .eligibleBbbeePoints,
      ).toBe(9);
      expect(
        scoreTender(facts(), company({ bbbeeLevel: 2 }), cleanVault(), "80/20", now)
          .eligibleBbbeePoints,
      ).toBe(18);
    });

    it("defaults to 80/20 and never lets points move the fit score", () => {
      const result = scoreTender(facts(), company({ bbbeeLevel: 1 }), cleanVault(), undefined, now);
      expect(result.eligibleBbbeePoints).toBe(20);
      expect(result.fitScore).toBe(100);
    });
  });

  describe("injected clock", () => {
    it("re-evaluates document currency against the supplied instant", () => {
      const docs = cleanVault();
      expect(scoreTender(facts(), company(), docs, "80/20", now).fitScore).toBe(100);
      const aYearLater = new Date("2028-01-01T00:00:00Z");
      const stale = scoreTender(facts(), company(), docs, "80/20", aYearLater);
      expect(stale.fitScore).toBe(20);
      expect(stale.riskFlags).toEqual([TAX_FLAG, COIDA_FLAG]);
      expect(stale.verdict).toBe("NO-GO");
    });
  });
});

describe("GO/CAUTION/NO-GO verdict thresholds", () => {
  it.each([
    [100, "GO"],
    [75.001, "GO"],
    [75, "GO"],
    [74.999, "CAUTION"],
    [74, "CAUTION"],
    [50.001, "CAUTION"],
    [50, "CAUTION"],
    [49.999, "NO-GO"],
    [49, "NO-GO"],
    [1, "NO-GO"],
    [0, "NO-GO"],
    [-1, "NO-GO"],
  ] as const)("scores %s verdict as %s", (score, expected) => {
    expect(verdictFromScore(score)).toBe(expected);
  });

  it("leaves a missing score unverdicted rather than defaulting to a band", () => {
    expect(verdictFromScore(null)).toBe("UNKNOWN");
    expect(verdictFromScore(undefined)).toBe("UNKNOWN");
  });

  it("keeps the two band edges one point apart across the whole range", () => {
    for (let score = 0; score <= 100; score++) {
      const verdict = verdictFromScore(score);
      if (score >= 75) expect(verdict).toBe("GO");
      else if (score >= 50) expect(verdict).toBe("CAUTION");
      else expect(verdict).toBe("NO-GO");
    }
  });

  it("carries presentation metadata for every verdict a tender can emit", () => {
    const emitted = new Set<string>();
    for (let score = 0; score <= 100; score++) emitted.add(verdictFromScore(score));
    emitted.add("UNKNOWN");
    for (const verdict of emitted) {
      expect(VERDICT_META[verdict]?.subtitle).toBeTruthy();
    }
  });
});
