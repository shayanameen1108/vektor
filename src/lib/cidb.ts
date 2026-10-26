/**
 * CIDB grade comparison utilities.
 * Ported verbatim from backend/cidb_utils.py
 */

const TOKEN_RE = /\b([1-9])\s*([A-Z]{2,3})\b/g;
const SINGLE_RE = /^\s*([1-9])\s*([A-Z]{2,3})\s*$/;

export type CidbGrade = [number, string];

export function parseCidbGrade(s: string | null | undefined): CidbGrade | null {
  if (!s) return null;
  const m = SINGLE_RE.exec(s.toUpperCase());
  if (!m || !m[1] || !m[2]) return null;
  return [Number(m[1]), m[2]];
}

export function parseCidbGrades(s: string | null | undefined): CidbGrade[] {
  if (!s) return [];
  const upper = s.toUpperCase();
  const seen = new Set<string>();
  const result: CidbGrade[] = [];
  let match: RegExpExecArray | null;
  // reset global regex state
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(upper)) !== null) {
    const g = Number(match[1]);
    const cls = match[2]!;
    const key = `${g}:${cls}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push([g, cls]);
    }
  }
  return result;
}

export function cidbMeetsRequirement(
  required: string | null | undefined,
  contractor: string | null | undefined,
): [boolean, string | null] {
  if (!required || !contractor) return [true, null];

  const contractorGrades = parseCidbGrades(contractor);
  if (contractorGrades.length === 0) return [true, null];

  const upperReq = required.toUpperCase();
  const tokens: [number, string][] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(upperReq)) !== null) {
    tokens.push([Number(m[1]), m[2]!]);
  }
  if (tokens.length === 0) return [true, null];

  const byClass = new Map<string, number[]>();
  for (const [g, cls] of tokens) {
    const arr = byClass.get(cls) ?? [];
    arr.push(g);
    byClass.set(cls, arr);
  }

  const contractorByClass = new Map<string, number[]>();
  for (const [grade, cls] of contractorGrades) {
    const arr = contractorByClass.get(cls) ?? [];
    arr.push(grade);
    contractorByClass.set(cls, arr);
  }

  const matchingClasses = [...byClass.keys()].filter((k) => contractorByClass.has(k));

  if (matchingClasses.length > 0) {
    for (const cls of matchingClasses) {
      const minReq = Math.min(...(byClass.get(cls) ?? []));
      const bestHeld = Math.max(...(contractorByClass.get(cls) ?? []));
      if (bestHeld >= minReq) return [true, null];
    }
    const cls = matchingClasses[0]!;
    const minReq = Math.min(...(byClass.get(cls) ?? []));
    const bestHeld = Math.max(...(contractorByClass.get(cls) ?? []));
    return [
      false,
      `WARNING: Tender requires CIDB grade ${minReq}${cls} or higher, but your highest ${cls} registration is ${bestHeld}${cls}. Consider a Joint Venture with a contractor holding ${minReq}${cls} or above.`,
    ];
  }

  const reqClasses = [...byClass.keys()].sort();
  const heldClasses = [...contractorByClass.keys()].sort();
  return [
    false,
    `WARNING: Tender requires CIDB class ${reqClasses.join("/")}, but your profile shows ${heldClasses.join("/")}. This tender falls outside your registered discipline — consider a Joint Venture with a specialist contractor.`,
  ];
}
