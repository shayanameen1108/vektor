import { describe, expect, it } from "vitest";

import { cidbMeetsRequirement, parseCidbGrade, parseCidbGrades } from "@/lib/cidb";

describe("cidb", () => {
  describe("parseCidbGrade", () => {
    it("parses 4EB -> [4, EB]", () => {
      expect(parseCidbGrade("4EB")).toEqual([4, "EB"]);
      expect(parseCidbGrade("4 EB")).toEqual([4, "EB"]);
      expect(parseCidbGrade(" 4EB ")).toEqual([4, "EB"]);
    });
    it("handles lower case", () => {
      expect(parseCidbGrade("4eb")).toEqual([4, "EB"]);
    });
    it("returns null for unparseable", () => {
      expect(parseCidbGrade("")).toBeNull();
      expect(parseCidbGrade(null as unknown as string)).toBeNull();
      expect(parseCidbGrade("10GB")).toBeNull(); // grade 10 out of 1-9
      expect(parseCidbGrade("GB")).toBeNull();
    });
  });

  describe("parseCidbGrades", () => {
    it("extracts multiple tokens deduplicated", () => {
      const grades = parseCidbGrades("4EB, 3GB, 6CE");
      expect(grades).toHaveLength(3);
      expect(grades).toEqual(
        expect.arrayContaining([
          [4, "EB"],
          [3, "GB"],
          [6, "CE"],
        ]),
      );
    });
    it("deduplicates repeated", () => {
      const grades = parseCidbGrades("4EB, 4EB");
      expect(grades).toHaveLength(1);
    });
    it("returns empty for null", () => {
      expect(parseCidbGrades(null as unknown as string)).toEqual([]);
      expect(parseCidbGrades("")).toEqual([]);
    });
  });

  describe("cidbMeetsRequirement", () => {
    it("returns true when contractor higher grade covers lower in same class", () => {
      const [meets, reason] = cidbMeetsRequirement("4EB", "6EB");
      expect(meets).toBe(true);
      expect(reason).toBeNull();

      const [meets2] = cidbMeetsRequirement("1EB", "4EB, 3GB");
      expect(meets2).toBe(true);
    });

    it("returns false when contractor lower than required in same class", () => {
      const [meets, reason] = cidbMeetsRequirement("6CE", "4CE");
      expect(meets).toBe(false);
      expect(reason).toContain("WARNING");
      expect(reason).toContain("6CE");
    });

    it("returns false when no overlapping class", () => {
      const [meets, reason] = cidbMeetsRequirement("4EB", "3GB");
      expect(meets).toBe(false);
      expect(reason).toContain("CIDB class");
      expect(reason).toContain("EB");
      expect(reason).toContain("GB");
    });

    it("returns true when either side missing (data gap never fails)", () => {
      expect(cidbMeetsRequirement(null, "4EB")[0]).toBe(true);
      expect(cidbMeetsRequirement("4EB", null)[0]).toBe(true);
      expect(cidbMeetsRequirement("unparseable requirement", "4EB")[0]).toBe(true);
    });

    it("handles enumeration with or Higher", () => {
      const [meets] = cidbMeetsRequirement("1EB, 2EB, 3EB, 4EB or Higher", "4EB");
      expect(meets).toBe(true);
      const [meets2] = cidbMeetsRequirement("4EB or Higher", "2EB");
      expect(meets2).toBe(false);
    });

    it("picks best held grade per class", () => {
      const [meets] = cidbMeetsRequirement("5GB", "4GB, 6GB");
      expect(meets).toBe(true); // 6GB covers 5GB
    });
  });
});
