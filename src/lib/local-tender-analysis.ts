/**
 * Deterministic stand-in for the Workers AI tender analysis, used when
 * ENVIRONMENT="local" (dev, e2e, CI), where the binding is not reachable. It
 * reads the facts the model is asked for with plain patterns, so a given PDF
 * always analyses the same way. Production never calls it.
 */

export interface LocalTenderAnalysis {
  tender_title: string;
  tender_number: string | null;
  issuing_entity: string | null;
  required_cidb: string | null;
  closing_date: string | null;
  mandatory_returnables: string[];
  evaluation_criteria: string[];
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const ENTITY = /\b(municipality|metropolitan|department|city of|council|agency|board|SOC Ltd)\b/i;
const CIDB_GRADE = /\b([1-9]\s?(?:GB|CE|EB|ME|EP|S[A-Q]))\b(\s*(?:PE\s*)?or\s+higher)?/i;

/** Returnables the stand-in recognises, each with the label it reports. */
const RETURNABLES: Array<[RegExp, string]> = [
  [/\bSBD\s*1\b/i, "SBD 1 – Invitation to bid"],
  [/\bSBD\s*4\b/i, "SBD 4 – Bidder's disclosure"],
  [/\bSBD\s*6\.1\b/i, "SBD 6.1 – Preference points claim"],
  [/\btax\s+(?:clearance|compliance)/i, "Tax compliance status PIN"],
  [/\bCSD\b|central supplier database/i, "CSD registration report"],
  [/\bB-?BBEE\b/i, "B-BBEE certificate or sworn affidavit"],
  [/\bCOIDA\b|letter of good standing/i, "COIDA letter of good standing"],
  [
    /compulsory\s+(?:clarification|briefing|site)\s+meeting/i,
    "Attendance at the compulsory clarification meeting",
  ],
];

const CRITERIA: Array<[RegExp, string]> = [
  [/\b80\s*\/\s*20\b/, "80/20 preference point system"],
  [/\b90\s*\/\s*10\b/, "90/10 preference point system"],
  [/\bfunctionality\b/i, "Functionality"],
];

export function localTenderAnalysis(pdfText: string): LocalTenderAnalysis {
  const lines = pdfText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const text = lines.join("\n");

  const tenderNumber =
    text.match(
      /\b(?:bid|tender|contract)\b(?:\s*(?:no\.?|number|ref(?:erence)?))?\s*[:-]\s*([A-Z0-9/.-]*\d[A-Z0-9/.-]*)/i,
    )?.[1] ?? null;
  const issuingEntity = lines.find((line) => ENTITY.test(line))?.slice(0, 300) ?? null;
  const description = text.match(/\bdescription\s*:\s*(.+)/i)?.[1];
  const title =
    description ??
    lines.find((line) => line !== issuingEntity && !line.includes(tenderNumber ?? "\0")) ??
    lines[0] ??
    "Untitled tender";

  const cidbLine = lines.find((line) => /\bCIDB\b/i.test(line) && CIDB_GRADE.test(line));
  const grade = (cidbLine ?? text).match(CIDB_GRADE);
  const requiredCidb = grade
    ? `${grade[1]!.replace(/\s/g, "").toUpperCase()}${grade[2] ? " or higher" : ""}`
    : null;

  const returnables = RETURNABLES.filter(([pattern]) => pattern.test(text)).map(
    ([, label]) => label,
  );
  if (requiredCidb) returnables.unshift(`CIDB registration (${requiredCidb})`);

  return {
    tender_title: title.slice(0, 500),
    tender_number: tenderNumber?.slice(0, 300) ?? null,
    issuing_entity: issuingEntity,
    required_cidb: requiredCidb,
    closing_date: closingDate(text),
    mandatory_returnables: returnables,
    evaluation_criteria: CRITERIA.filter(([pattern]) => pattern.test(text)).map(
      ([, label]) => label,
    ),
  };
}

/** The first date after "closing date", as ISO YYYY-MM-DD. */
function closingDate(text: string): string | null {
  const after = text.match(/closing\s+date[^\n]*/i)?.[0];
  if (!after) return null;
  const iso = after.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const long = after.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (!long) return null;
  const month = MONTHS.findIndex((name) => name.startsWith(long[2]!.toLowerCase().slice(0, 3)));
  return month < 0 ? null : validDate(Number(long[3]), month + 1, Number(long[1]));
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
