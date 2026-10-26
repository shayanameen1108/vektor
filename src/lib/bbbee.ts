/**
 * B-BBEE points calculation — ported verbatim from backend/deps.py calculate_bbbee_points
 */

export type PreferenceSystem = "80/20" | "90/10";

const BBBEE_POINTS: Record<PreferenceSystem, Record<number, number>> = {
  "80/20": {
    1: 20,
    2: 18,
    3: 14,
    4: 12,
    5: 8,
    6: 6,
    7: 4,
    8: 2,
  },
  "90/10": { 1: 10, 2: 9, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 },
};

export function calculateBbbeePoints(
  bbbeeLevel: number | null | undefined,
  preferenceSystem: PreferenceSystem = "80/20",
): number {
  if (!bbbeeLevel) return 0;
  const level = Number(bbbeeLevel);
  if (!Number.isInteger(level) || level < 1 || level > 8) return 0;
  const table = BBBEE_POINTS[preferenceSystem] ?? BBBEE_POINTS["80/20"];
  return table[level] ?? 0;
}

/** Max preference points for a PPPFA system — single source for UI denominators. */
export function maxBbbeePoints(preferenceSystem: string | null | undefined): number {
  return preferenceSystem === "90/10" ? 10 : 20;
}
