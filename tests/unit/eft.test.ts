import { afterEach, describe, expect, it, vi } from "vitest";

import { generateReference, rolloverCapForCycleCredits } from "@/lib/eft";

/**
 * EFT reference format and credit rollover cap (spec story 25 and the
 * preserved EFT state machine). Collision retry is NOT part of this
 * function: it lives in the caller at src/routes/api/eft/request.ts, which
 * re-draws a reference up to five times against the unique index.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

afterEach(() => {
  vi.restoreAllMocks();
});

function sample(count: number): string[] {
  return Array.from({ length: count }, () => generateReference());
}

describe("EFT payment reference generation", () => {
  it("emits VEK- followed by exactly six characters", () => {
    for (const reference of sample(500)) {
      expect(reference).toMatch(/^VEK-[A-Z0-9]{6}$/);
    }
  });

  it("reaches every symbol of the alphabet", () => {
    const observed = new Set<string>();
    for (const reference of sample(20_000)) {
      for (const character of reference.slice(4)) observed.add(character);
    }
    expect([...observed].sort().join("")).toBe(ALPHABET.split("").sort().join(""));
  });

  it("excludes the glyphs that get mis-read off a bank slip", () => {
    expect(sample(3000).some((reference) => /[IO01]/.test(reference.slice(4)))).toBe(false);
  });

  it("maps each of the six draws onto the alphabet in order", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generateReference()).toBe("VEK-AAAAAA");
    vi.spyOn(Math, "random").mockReturnValue(0.99999999);
    expect(generateReference()).toBe("VEK-999999");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(generateReference()).toBe("VEK-SSSSSS");
  });

  it("walks the alphabet boundary between letters and digits", () => {
    const draws = [0, 23 / 32, 24 / 32, 31 / 32, 0, 0];
    let index = 0;
    vi.spyOn(Math, "random").mockImplementation(() => draws[index++] ?? 0);
    expect(generateReference()).toBe("VEK-AZ29AA");
  });

  it("returns a fresh reference on every call so a collision can be retried", () => {
    expect(generateReference()).not.toBe(generateReference());
    expect(new Set(sample(2000)).size).toBe(2000);
  });
});

describe("EFT credit rollover cap", () => {
  it.each([
    ["tc_starter_monthly_v2", 5, 10],
    ["tc_pro_monthly_v2", 20, 40],
    ["tc_scale_monthly_v2", 50, 100],
    ["tc_credits_1_v2 (PAYG)", 1, 2],
    ["no subscription cycle", 0, 0],
  ] as const)("caps %s at %i credits", (_name, cycleCredits, expected) => {
    expect(rolloverCapForCycleCredits(cycleCredits)).toBe(expected);
  });

  it("banks exactly twice the monthly allowance for every cycle size", () => {
    for (const cycleCredits of [1, 2, 3, 5, 8, 10, 13, 20, 33, 50, 64, 100]) {
      const cap = rolloverCapForCycleCredits(cycleCredits);
      expect(cap).toBe(cycleCredits * 2);
      expect(cap - cycleCredits).toBe(cycleCredits);
    }
  });

  it("grows with the cycle so a larger plan keeps proportionally more", () => {
    expect(rolloverCapForCycleCredits(20)).toBeGreaterThan(rolloverCapForCycleCredits(5));
    expect(rolloverCapForCycleCredits(50)).toBeGreaterThan(rolloverCapForCycleCredits(20));
  });

  /**
   * Mirrors the documented renewal rule as the EFT confirm handler applies it:
   * a renewal tops the balance up but never past the cap, and a balance already
   * above a smaller new cap is not clawed back. Only the cap comes from src.
   */
  function balanceAfterRenewal(held: number, cycleCredits: number): number {
    const cap = rolloverCapForCycleCredits(cycleCredits);
    return Math.max(held, Math.min(held + cycleCredits, cap));
  }

  it.each([
    ["fresh subscriber, nothing banked", 0, 20, 20],
    ["below the cap", 15, 20, 35],
    ["one full cycle banked, at the cap", 20, 20, 40],
    ["above one cycle but under the cap", 25, 20, 40],
    ["already at the cap", 40, 20, 40],
    ["over the cap after a downgrade", 55, 5, 55],
  ] as const)("%s keeps %i credits after renewal", (_name, held, cycleCredits, expected) => {
    expect(balanceAfterRenewal(held, cycleCredits)).toBe(expected);
  });

  it("never lets a renewal at the cap exceed twice the allowance", () => {
    for (const cycleCredits of [1, 5, 20, 50]) {
      const cap = rolloverCapForCycleCredits(cycleCredits);
      expect(balanceAfterRenewal(cap, cycleCredits)).toBe(cap);
      expect(balanceAfterRenewal(cap - 1, cycleCredits)).toBe(cap);
    }
  });
});
