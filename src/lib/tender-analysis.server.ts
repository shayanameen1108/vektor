/**
 * Paid tender analysis — the production write path behind
 * POST /api/tenders/analyze. Server-only: consumes the Credit, stores the
 * source PDF, runs the injected analysis boundary, scores, persists, and
 * restores the Credit when the pipeline fails. Lives outside the route
 * because it owns production SQL and external-boundary calls.
 */

import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import type { CompanyRow } from "@/db/schema/company";
import { complianceDocuments } from "@/db/schema/compliance";
import { tenders } from "@/db/schema/tender";
import type { AiResult } from "@/lib/ai";
import type { PreferenceSystem } from "@/lib/bbbee";
import { extractTextFromPdfBytes, TENDER_EXTRACT_PAGES } from "@/lib/compliance";
import { consumeCredit, refundCredit } from "@/lib/credits";
import { deleteQuietly } from "@/lib/r2-response";
import { scoreTender } from "@/lib/tender-scoring";
import { parseStringList } from "@/lib/utils";

class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 500 | 502,
    readonly detail: string,
  ) {
    super(message);
  }
}

export interface TenderAnalysis {
  tender_id: string;
  tender_title: string;
  required_cidb: string | null;
  mandatory_returnables: string[];
  evaluation_criteria: string[];
  fit_score: number;
  risk_flags: string[];
  verdict: string;
  eligible_bbbee_points: number;
  preference_point_system: PreferenceSystem;
  closing_date: string | null;
  returnable_status: Record<string, { verified: boolean; verified_at: null; doc_ref: null }>;
}

export type AnalyzeOutcome =
  | { ok: true; analysis: TenderAnalysis }
  | { ok: false; status: 400 | 402 | 500 | 502; detail: string };

/**
 * Boundaries the Worker supplies at the edge: the R2 bucket and the tender
 * analyzer. Tests preset the boundary outcomes; the consume/refund/persist
 * logic under test is the real production code.
 */
export interface AnalyzeBoundary {
  storage: {
    put(
      key: string,
      value: Uint8Array,
      options?: { httpMetadata?: { contentType?: string } },
    ): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
  analyze(pdfText: string): Promise<AiResult>;
}

export async function analyzeTender(
  db: Database,
  boundary: AnalyzeBoundary,
  input: { company: CompanyRow; bytes: Uint8Array; preferenceSystem: PreferenceSystem },
): Promise<AnalyzeOutcome> {
  const companyId = input.company.id;
  if (!(await consumeCredit(db, companyId))) {
    return {
      ok: false,
      status: 402,
      detail: "Insufficient credits. Please purchase a credit pack or subscribe to a monthly plan.",
    };
  }

  const pdfStorageKey = `tenders/${companyId}/${crypto.randomUUID()}.pdf`;
  let stored = false;
  try {
    let pdfText: string;
    try {
      pdfText = await extractTextFromPdfBytes(input.bytes, TENDER_EXTRACT_PAGES);
      if (!pdfText.trim()) throw new Error("PDF contains no extractable text");
    } catch (error) {
      throw new AnalyzeError(String(error), 400, "Failed to extract PDF text");
    }

    try {
      await boundary.storage.put(pdfStorageKey, input.bytes, {
        httpMetadata: { contentType: "application/pdf" },
      });
      stored = true;
    } catch (error) {
      throw new AnalyzeError(String(error), 500, "Tender file storage failed");
    }

    let aiResult: AiResult;
    try {
      aiResult = await boundary.analyze(pdfText);
    } catch (error) {
      throw new AnalyzeError(
        error instanceof Error ? error.message : String(error),
        502,
        "AI could not parse this tender document",
      );
    }

    const docs = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.companyId, companyId));
    const scoring = scoreTender(
      aiResult,
      {
        bbbeeLevel: input.company.bbbeeLevel,
        cidbCrsNum: input.company.cidbCrsNum,
        bargainingCouncils: parseStringList(input.company.bargainingCouncils),
      },
      docs.map((document) => ({
        docType: document.docType,
        isCompliant: Boolean(document.isCompliant),
        bargainingCouncil: document.bargainingCouncil ?? null,
        expiryDate: document.expiryDate ?? null,
      })),
      input.preferenceSystem,
    );

    const returnableStatus = Object.fromEntries(
      aiResult.mandatory_returnables.map((name) => [
        name,
        { verified: false, verified_at: null, doc_ref: null },
      ]),
    );
    const tenderId = crypto.randomUUID();
    const now = new Date();
    await db.insert(tenders).values({
      id: tenderId,
      companyId,
      tenderNumber: aiResult.tender_number,
      title: aiResult.tender_title,
      issuingEntity: aiResult.issuing_entity,
      closingDate: aiResult.closing_date,
      requiredCidbGrade: aiResult.required_cidb,
      preferencePointSystem: input.preferenceSystem,
      parsedReturnables: JSON.stringify(aiResult.mandatory_returnables),
      evaluationCriteria: JSON.stringify(aiResult.evaluation_criteria),
      fitScore: scoring.fitScore,
      riskFlags: JSON.stringify(scoring.riskFlags),
      eligibleBbbeePoints: scoring.eligibleBbbeePoints,
      returnableStatus: JSON.stringify(returnableStatus),
      pdfStorageKey,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      analysis: {
        tender_id: tenderId,
        tender_title: aiResult.tender_title,
        required_cidb: aiResult.required_cidb,
        mandatory_returnables: aiResult.mandatory_returnables,
        evaluation_criteria: aiResult.evaluation_criteria,
        fit_score: scoring.fitScore,
        risk_flags: scoring.riskFlags,
        verdict: scoring.verdict,
        eligible_bbbee_points: scoring.eligibleBbbeePoints,
        preference_point_system: input.preferenceSystem,
        closing_date: aiResult.closing_date,
        returnable_status: returnableStatus,
      },
    };
  } catch (error) {
    if (stored) await deleteQuietly(boundary.storage, pdfStorageKey, "tender");
    const refunded = await refundCredit(db, companyId)
      .then(() => true)
      .catch(() => false);
    console.error("Tender analysis failed after credit consumption", error);
    if (!refunded) {
      return {
        ok: false,
        status: 500,
        detail: "Analysis failed and the automatic credit refund failed. Please contact support.",
      };
    }
    const failure = error instanceof AnalyzeError ? error : null;
    return {
      ok: false,
      status: failure?.status ?? 500,
      detail: `${failure?.detail ?? "Analysis failed unexpectedly"}. Your credit has been refunded.`,
    };
  }
}
