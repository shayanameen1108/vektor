import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { complianceDocuments } from "@/db/schema/compliance";
import { tenders } from "@/db/schema/tender";
import { analyzeTenderWithAi } from "@/lib/ai";
import { extractTextFromPdfBytes, TENDER_EXTRACT_PAGES } from "@/lib/compliance";
import { consumeCredit, refundCredit } from "@/lib/credits";
import { fetchOwnedCompany } from "@/lib/ownership";
import { deleteQuietly } from "@/lib/r2-response";
import { asString } from "@/lib/request-utils";
import { requireUser } from "@/lib/server-auth";
import { scoreTender } from "@/lib/tender-scoring";
import { parseStringList } from "@/lib/utils";

/** Protects Worker memory while allowing normal municipal tender packs. */
const MAX_TENDER_BYTES = 20 * 1024 * 1024;

class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 500 | 502,
    readonly detail: string,
  ) {
    super(message);
  }
}

export const Route = createFileRoute("/api/tenders/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const formData = await request.formData().catch(() => null);
        if (!formData) return Response.json({ detail: "Invalid form data" }, { status: 400 });
        const file = formData.get("file");
        const companyId = asString(formData.get("company_id"));
        const preferenceSystem = formData.get("preference_system") === "90/10" ? "90/10" : "80/20";

        if (!(file instanceof File))
          return Response.json({ detail: "File is required" }, { status: 400 });
        if (!companyId) return Response.json({ detail: "company_id is required" }, { status: 400 });
        if (file.size === 0)
          return Response.json({ detail: "Uploaded file is empty" }, { status: 400 });
        if (file.size > MAX_TENDER_BYTES) {
          return Response.json({ detail: "Tender PDF is too large (max 20MB)" }, { status: 400 });
        }
        if (
          file.type.toLowerCase() !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        ) {
          return Response.json({ detail: "Only PDF files are supported" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, companyId, session);
        if (company instanceof Response) return company;

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!hasPdfMagic(bytes)) {
          return Response.json({ detail: "The uploaded file is not a valid PDF" }, { status: 400 });
        }

        if (!(await consumeCredit(db, companyId))) {
          return Response.json(
            {
              detail:
                "Insufficient credits. Please purchase a credit pack or subscribe to a monthly plan.",
            },
            { status: 402 },
          );
        }

        const pdfStorageKey = `tenders/${companyId}/${crypto.randomUUID()}.pdf`;
        let stored = false;
        try {
          let pdfText: string;
          try {
            pdfText = await extractTextFromPdfBytes(bytes, TENDER_EXTRACT_PAGES);
            if (!pdfText.trim()) throw new Error("PDF contains no extractable text");
          } catch (error) {
            throw new AnalyzeError(String(error), 400, "Failed to extract PDF text");
          }

          try {
            await env.STORAGE.put(pdfStorageKey, bytes, {
              httpMetadata: { contentType: "application/pdf" },
            });
            stored = true;
          } catch (error) {
            throw new AnalyzeError(String(error), 500, "Tender file storage failed");
          }

          let aiResult;
          try {
            aiResult = await analyzeTenderWithAi(pdfText);
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
              bbbeeLevel: company.bbbeeLevel,
              cidbCrsNum: company.cidbCrsNum,
              bargainingCouncils: parseStringList(company.bargainingCouncils),
            },
            docs.map((document) => ({
              docType: document.docType,
              isCompliant: Boolean(document.isCompliant),
              bargainingCouncil: document.bargainingCouncil ?? null,
              expiryDate: document.expiryDate ?? null,
            })),
            preferenceSystem,
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
            preferencePointSystem: preferenceSystem,
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

          return Response.json({
            tender_id: tenderId,
            tender_title: aiResult.tender_title,
            required_cidb: aiResult.required_cidb,
            mandatory_returnables: aiResult.mandatory_returnables,
            evaluation_criteria: aiResult.evaluation_criteria,
            fit_score: scoring.fitScore,
            risk_flags: scoring.riskFlags,
            verdict: scoring.verdict,
            eligible_bbbee_points: scoring.eligibleBbbeePoints,
            preference_point_system: preferenceSystem,
            closing_date: aiResult.closing_date,
            returnable_status: returnableStatus,
          });
        } catch (error) {
          if (stored) await deleteQuietly(env.STORAGE, pdfStorageKey, "tender");
          const refunded = await refundCredit(db, companyId)
            .then(() => true)
            .catch(() => false);
          console.error("Tender analysis failed after credit consumption", error);
          if (!refunded) {
            return Response.json(
              {
                detail:
                  "Analysis failed and the automatic credit refund failed. Please contact support.",
              },
              { status: 500 },
            );
          }
          const failure = error instanceof AnalyzeError ? error : null;
          return Response.json(
            {
              detail: `${failure?.detail ?? "Analysis failed unexpectedly"}. Your credit has been refunded.`,
            },
            { status: failure?.status ?? 500 },
          );
        }
      },
    },
  },
});

function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}
