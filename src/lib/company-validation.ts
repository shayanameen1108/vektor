import type { companies } from "@/db/schema/company";
import { VALID_COUNCIL_CODES } from "@/lib/bargaining-councils";
import { verifyCipc, verifyCsdMaaa, verifySarsTcs } from "@/lib/verification";

const VALID_PPPFA = new Set(["80/20", "90/10"]);

interface StatutoryFields {
  cipcNum?: string;
  csdMaaaNum?: string | null;
  sarsTcsPin?: string | null;
}

/** Validate supplied statutory fields and return database-ready normalized values. */
export function validateStatutoryFields(
  body: Record<string, unknown>,
  options: { requireCipc?: boolean } = {},
): StatutoryFields {
  const result: StatutoryFields = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  if (options.requireCipc && !has("cipc_num")) {
    throw new Error("CIPC number is required");
  }
  if (has("cipc_num")) {
    if (typeof body.cipc_num !== "string") {
      throw new Error("CIPC number must be a string");
    }
    const verification = verifyCipc(body.cipc_num);
    if (!verification.valid) {
      throw new Error(`Invalid CIPC number: ${verification.reason}`);
    }
    result.cipcNum = verification.normalized!;
  }

  for (const [inputKey, outputKey, label, verify] of [
    ["csd_maaa_num", "csdMaaaNum", "CSD/MAAA number", verifyCsdMaaa],
    ["sars_tcs_pin", "sarsTcsPin", "SARS TCS PIN", verifySarsTcs],
  ] as const) {
    if (!has(inputKey)) continue;
    const value = body[inputKey];
    if (value === null) {
      result[outputKey] = null;
      continue;
    }
    if (typeof value !== "string") {
      throw new Error(`${label} must be a string or null`);
    }
    if (value.trim() === "") {
      result[outputKey] = null;
      continue;
    }
    const verification = verify(value);
    if (!verification.valid) {
      throw new Error(`Invalid ${label}: ${verification.reason}`);
    }
    result[outputKey] = verification.normalized!;
  }

  return result;
}

export function validateCouncils(codes: unknown): string[] | null {
  if (codes == null) return null;
  if (!Array.isArray(codes)) throw new Error("bargaining_councils must be an array");
  const unique = [...new Set(codes as string[])];
  const unknown = unique.filter((c) => !VALID_COUNCIL_CODES.has(c));
  if (unknown.length > 0) {
    throw new Error(`Unknown bargaining council code(s): ${unknown.join(", ")}`);
  }
  return unique;
}

export function validatePppfa(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !VALID_PPPFA.has(value)) {
    throw new Error(
      `Invalid PPPFA preference system: ${String(value as string)}. Must be one of 80/20, 90/10`,
    );
  }
  return value;
}

export function toApiCompany(row: typeof companies.$inferSelect) {
  return {
    id: row.id,
    company_name: row.companyName,
    cipc_num: row.cipcNum,
    csd_maaa_num: row.csdMaaaNum,
    sars_tcs_pin: row.sarsTcsPin,
    cidb_crs_num: row.cidbCrsNum,
    bbbee_level: row.bbbeeLevel,
    contact_email: row.contactEmail,
    contact_phone: row.contactPhone,
    authorised_signatory_name: row.authorisedSignatoryName,
    authorised_signatory_position: row.authorisedSignatoryPosition,
    bargaining_councils: row.bargainingCouncils ? JSON.parse(row.bargainingCouncils) : [],
    preferred_pppfa_system: row.preferredPppfaSystem,
    alerts_enabled: row.alertsEnabled,
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
    user_id: row.userId,
  };
}

export function nullIfBlank(v: unknown): string | null {
  return typeof v === "string" ? (v.trim() === "" ? null : v) : null;
}
