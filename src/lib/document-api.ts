import type { complianceDocuments } from "@/db/schema/compliance";

type DocRow = typeof complianceDocuments.$inferSelect;

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
