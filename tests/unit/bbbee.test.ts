import { describe, expect, it } from "vitest";

import { calculateBbbeePoints, maxBbbeePoints } from "@/lib/bbbee";

describe("bbbee — points per preference system", () => {
  it("returns 0 when level null or undefined", () => {
    expect(calculateBbbeePoints(null, "80/20")).toBe(0);
    expect(calculateBbbeePoints(undefined, "90/10")).toBe(0);
    expect(calculateBbbeePoints(0 as unknown as number, "80/20")).toBe(0);
  });

  it("80/20 mapping matches spec", () => {
    expect(calculateBbbeePoints(1, "80/20")).toBe(20);
    expect(calculateBbbeePoints(2, "80/20")).toBe(18);
    expect(calculateBbbeePoints(3, "80/20")).toBe(14);
    expect(calculateBbbeePoints(4, "80/20")).toBe(12);
    expect(calculateBbbeePoints(5, "80/20")).toBe(8);
    expect(calculateBbbeePoints(6, "80/20")).toBe(6);
    expect(calculateBbbeePoints(7, "80/20")).toBe(4);
    expect(calculateBbbeePoints(8, "80/20")).toBe(2);
  });

  it("90/10 mapping matches spec", () => {
    expect(calculateBbbeePoints(1, "90/10")).toBe(10);
    expect(calculateBbbeePoints(2, "90/10")).toBe(9);
    expect(calculateBbbeePoints(3, "90/10")).toBe(6);
    expect(calculateBbbeePoints(4, "90/10")).toBe(5);
    expect(calculateBbbeePoints(5, "90/10")).toBe(4);
    expect(calculateBbbeePoints(6, "90/10")).toBe(3);
    expect(calculateBbbeePoints(7, "90/10")).toBe(2);
    expect(calculateBbbeePoints(8, "90/10")).toBe(1);
  });

  it("defaults to 80/20 when preference system missing", () => {
    expect(calculateBbbeePoints(1)).toBe(20);
  });

  it("returns 0 for out-of-range level", () => {
    expect(calculateBbbeePoints(9, "80/20")).toBe(0);
    expect(calculateBbbeePoints(10, "90/10")).toBe(0);
  });

  it("max points follow the PPPFA denominator", () => {
    expect(maxBbbeePoints("90/10")).toBe(10);
    expect(maxBbbeePoints("80/20")).toBe(20);
    expect(maxBbbeePoints(null)).toBe(20);
    expect(maxBbbeePoints(undefined)).toBe(20);
  });
});
