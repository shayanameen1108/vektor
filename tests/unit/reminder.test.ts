import { describe, expect, it } from "vitest";

import { REMINDER_THRESHOLDS, daysUntil, pickThreshold } from "@/lib/reminder";

describe("reminder thresholds", () => {
  it("uses the legacy 30, 7, and 0 thresholds", () => {
    expect([...REMINDER_THRESHOLDS]).toEqual([30, 7, 0]);
  });

  it("chooses the tightest catch-up window", () => {
    expect(pickThreshold(31)).toBeNull();
    expect(pickThreshold(30)).toBe(30);
    expect(pickThreshold(8)).toBe(30);
    expect(pickThreshold(7)).toBe(7);
    expect(pickThreshold(1)).toBe(7);
    expect(pickThreshold(0)).toBe(0);
    expect(pickThreshold(-10)).toBe(0);
    expect(pickThreshold(null)).toBeNull();
  });

  it("calculates whole UTC days deterministically", () => {
    const now = new Date("2026-01-10T12:00:00.000Z");
    expect(daysUntil(new Date("2026-02-09T12:00:00.000Z"), now)).toBe(30);
    expect(daysUntil(new Date("2026-01-17T12:00:00.000Z"), now)).toBe(7);
    expect(daysUntil(now, now)).toBe(0);
    expect(daysUntil("not-a-date", now)).toBeNull();
  });
});
