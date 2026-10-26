import { z } from "zod";

import type { complianceDocuments } from "@/db/schema/compliance";

type DocRow = typeof complianceDocuments.$inferSelect;

/**
 * Shared PATCH input for compliance documents. Wrong types now 400 instead
 * of being coerced (`Boolean("false")`, `String(null)`); domain rules —
 * expiry required per doc type, council validity — stay in the route.
 */
export const documentPatchSchema = z.object({
  expiry_date: z.string({ error: "expiry_date must be a string or null" }).nullable().optional(),
  is_compliant: z.boolean({ error: "is_compliant must be a boolean" }).optional(),
  bargaining_council: z
    .string({ error: "bargaining_council must be a string or null" })
    .nullable()
    .optional(),
});

export type DocumentPatchInput = z.infer<typeof documentPatchSchema>;

/** Single serializer for compliance document rows. */
export function toApiDoc(row: DocRow) {
  const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  return {
    id: row.id,
    company_id: row.companyId,
    doc_type: row.docType,
    file_name: row.fileName,
    expiry_date: iso(row.expiryDate),
    is_compliant: Boolean(row.isCompliant),
    storage_key: row.storageKey,
    bargaining_council: row.bargainingCouncil ?? null,
    extracted_bbbee_level: row.extractedBbbeeLevel ?? null,
    extracted_expiry_date: iso(row.extractedExpiryDate),
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
  };
}
