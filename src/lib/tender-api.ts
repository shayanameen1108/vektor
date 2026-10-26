import type { TenderRow } from "@/db/schema/tender";

function parseJson<T>(
  value: string | null | undefined,
  fallback: T,
  predicate: (v: unknown) => v is T,
): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return predicate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function toApiTender(row: TenderRow) {
  return {
    id: row.id,
    company_id: row.companyId,
    tender_number: row.tenderNumber,
    title: row.title,
    issuing_entity: row.issuingEntity,
    closing_date: row.closingDate,
    required_cidb_grade: row.requiredCidbGrade,
    preference_point_system: row.preferencePointSystem,
    parsed_returnables: parseJson(row.parsedReturnables, [] as unknown[], isArray),
    evaluation_criteria: parseJson(row.evaluationCriteria, [] as unknown[], isArray),
    fit_score: row.fitScore,
    risk_flags: parseJson(row.riskFlags, [] as unknown[], isArray),
    eligible_bbbee_points: row.eligibleBbbeePoints,
    returnable_status: parseJson(
      row.returnableStatus,
      {} as Record<string, unknown>,
      (v): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v),
    ),
    pdf_storage_key: row.pdfStorageKey,
    created_at: new Date(row.createdAt).toISOString(),
    updated_at: new Date(row.updatedAt).toISOString(),
  };
}
