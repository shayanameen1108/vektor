import { afterEach, describe, expect, it, vi } from "vite-plus/test";

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

describe("EFT payment reference generation", () => {
  it("emits VEK- followed by exactly six characters", () => {
    expect(generateReference()).toMatch(/^VEK-[A-Z0-9]{6}$/);
  });

  it("maps the whole draw range onto an alphabet without ambiguous glyphs", () => {
    const random = vi.spyOn(Math, "random");
    const seen = new Set<string>();
    for (let index = 0; index < ALPHABET.length; index++) {
      random.mockReturnValue(index / ALPHABET.length);
      seen.add(generateReference().slice(4, 5));
    }
    expect([...seen].sort().join("")).toBe(ALPHABET.split("").sort().join(""));
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

  it("draws fresh randomness per reference so a collision can be retried", () => {
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0);
    const first = generateReference();
    random.mockReturnValue(0.99999999);
    const second = generateReference();
    expect(second).not.toBe(first);
    expect(random).toHaveBeenCalledTimes(12);
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

  it("grows with the cycle so a larger plan keeps proportionally more", () => {
    expect(rolloverCapForCycleCredits(20)).toBeGreaterThan(rolloverCapForCycleCredits(5));
    expect(rolloverCapForCycleCredits(50)).toBeGreaterThan(rolloverCapForCycleCredits(20));
  });
});
