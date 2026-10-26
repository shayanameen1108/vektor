import { z } from "zod";

import type { companies } from "@/db/schema/company";
import { VALID_COUNCIL_CODES } from "@/lib/bargaining-councils";
import { verifyCipc, verifyCsdMaaa, verifySarsTcs } from "@/lib/verification";

const VALID_PPPFA = new Set(["80/20", "90/10"]);

type VerifyFn = (value: string) => {
  valid: boolean;
  reason?: string;
  normalized?: string;
};

/** The first issue is the actionable 400 detail returned to the client. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/**
 * Shared company payload schema used by POST /api/companies, PATCH
 * /api/companies/:id, and the setup UI — one definition so the three
 * consumers cannot drift. Statutory fields keep their format checks and
 * return normalized values; wrong types now fail instead of being coerced.
 */

/** Optional text field: strings or null only; "" collapses to null. */
const optionalText = z
  .string({ error: "Must be a string or null" })
  .nullable()
  .transform((v) => (v == null || v.trim() === "" ? null : v))
  .optional();

/** Optional statutory field: null/"" clear; format verified, output normalized. */
const optionalStatutory = (label: string, verify: VerifyFn) =>
  z
    .string({ error: `${label} must be a string or null` })
    .nullable()
    .transform((v, ctx) => {
      if (v == null || v.trim() === "") return null;
      const result = verify(v);
      if (!result.valid) {
        ctx.addIssue({ code: "custom", message: `Invalid ${label}: ${result.reason}` });
        return z.NEVER;
      }
      return result.normalized!;
    })
    .optional();

const companyNameField = z
  .string({
    error: (iss) =>
      iss.input === undefined ? "Company name is required" : "company_name must be a string",
  })
  .trim()
  .min(1, "company_name cannot be empty");

const cipcField = z
  .string({
    error: (iss) =>
      iss.input === undefined ? "CIPC number is required" : "CIPC number must be a string",
  })
  .transform((v, ctx) => {
    const result = verifyCipc(v);
    if (!result.valid) {
      ctx.addIssue({ code: "custom", message: `Invalid CIPC number: ${result.reason}` });
      return z.NEVER;
    }
    return result.normalized!;
  });

const bbbeeField = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((v, ctx) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      ctx.addIssue({ code: "custom", message: "bbbee_level must be between 1 and 8" });
      return z.NEVER;
    }
    return n;
  })
  .optional();

const councilsField = z
  .array(z.string())
  .nullable()
  .transform((v, ctx) => {
    if (v == null) return null;
    const unique = [...new Set(v)];
    const unknown = unique.filter((c) => !VALID_COUNCIL_CODES.has(c));
    if (unknown.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown bargaining council code(s): ${unknown.join(", ")}`,
      });
      return z.NEVER;
    }
    return unique;
  })
  .optional();

const pppfaField = z
  .string()
  .nullable()
  .transform((v, ctx) => {
    if (v == null || v === "") return null;
    if (!VALID_PPPFA.has(v)) {
      ctx.addIssue({
        code: "custom",
        message: `Invalid PPPFA preference system: ${v}. Must be one of 80/20, 90/10`,
      });
      return z.NEVER;
    }
    return v;
  })
  .optional();

export const companyInputSchema = z.object({
  company_name: companyNameField,
  cipc_num: cipcField,
  csd_maaa_num: optionalStatutory("CSD/MAAA number", verifyCsdMaaa),
  sars_tcs_pin: optionalStatutory("SARS TCS PIN", verifySarsTcs),
  cidb_crs_num: optionalText,
  bbbee_level: bbbeeField,
  contact_email: optionalText,
  contact_phone: optionalText,
  authorised_signatory_name: optionalText,
  authorised_signatory_position: optionalText,
  bargaining_councils: councilsField,
  preferred_pppfa_system: pppfaField,
  alerts_enabled: z.boolean().optional(),
});

/** PATCH accepts the same shape with every key optional — only-sent keys apply. */
export const companyPatchSchema = companyInputSchema.partial();

/** The statutory subset the setup UI checks live for its "ready" indicator. */
export const statutoryInputSchema = companyInputSchema.pick({
  cipc_num: true,
  csd_maaa_num: true,
  sars_tcs_pin: true,
});

export type CompanyPatchInput = z.infer<typeof companyPatchSchema>;

/** PATCH input keys -> company table columns; councils serialize to JSON. */
export function companyPatchUpdates(input: CompanyPatchInput): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const set = (key: keyof CompanyPatchInput, column: string) => {
    if (input[key] !== undefined) updates[column] = input[key];
  };
  set("company_name", "companyName");
  set("cipc_num", "cipcNum");
  set("csd_maaa_num", "csdMaaaNum");
  set("sars_tcs_pin", "sarsTcsPin");
  set("cidb_crs_num", "cidbCrsNum");
  set("bbbee_level", "bbbeeLevel");
  set("contact_email", "contactEmail");
  set("contact_phone", "contactPhone");
  set("authorised_signatory_name", "authorisedSignatoryName");
  set("authorised_signatory_position", "authorisedSignatoryPosition");
  if (input.bargaining_councils !== undefined) {
    updates.bargainingCouncils =
      input.bargaining_councils == null ? null : JSON.stringify(input.bargaining_councils);
  }
  set("preferred_pppfa_system", "preferredPppfaSystem");
  set("alerts_enabled", "alertsEnabled");
  return updates;
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
