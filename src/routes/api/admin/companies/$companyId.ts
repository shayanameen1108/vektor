import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { user } from "@/db/schema/auth";
import { complianceDocuments, sentReminders } from "@/db/schema/compliance";
import { companies } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import { eftPayments } from "@/db/schema/eft";
import { tenders } from "@/db/schema/tender";
import { deleteQuietly } from "@/lib/r2-response";
import { requireAdmin } from "@/lib/server-auth";
import { returnableDocKeys } from "@/lib/tender-returnables";

export const Route = createFileRoute("/api/admin/companies/$companyId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const db = createDb(env.DB);
        const rows = await db
          .select({ company: companies, ownerEmail: user.email, ownerName: user.name })
          .from(companies)
          .leftJoin(user, eq(companies.userId, user.id))
          .where(eq(companies.id, params.companyId));
        const row = rows[0];
        if (!row) return Response.json({ detail: "Company not found" }, { status: 404 });

        const nowMs = Date.now();
        const docs = await db
          .select()
          .from(complianceDocuments)
          .where(eq(complianceDocuments.companyId, params.companyId));
        const tenderRows = await db
          .select({
            id: tenders.id,
            title: tenders.title,
            fitScore: tenders.fitScore,
            createdAt: tenders.createdAt,
          })
          .from(tenders)
          .where(eq(tenders.companyId, params.companyId));
        const credit = (
          await db
            .select()
            .from(companyCredits)
            .where(eq(companyCredits.companyId, params.companyId))
        )[0];
        const reminders = await db
          .select({
            id: sentReminders.id,
            threshold: sentReminders.threshold,
            sentAt: sentReminders.sentAt,
          })
          .from(sentReminders)
          .where(eq(sentReminders.companyId, params.companyId));
        const payments = await db
          .select({
            id: eftPayments.id,
            reference: eftPayments.reference,
            status: eftPayments.status,
          })
          .from(eftPayments)
          .where(eq(eftPayments.companyId, params.companyId));

        return Response.json({
          company: {
            id: row.company.id,
            company_name: row.company.companyName,
            cipc_num: row.company.cipcNum,
            user_id: row.company.userId,
            bbbee_level: row.company.bbbeeLevel,
            cidb_crs_num: row.company.cidbCrsNum,
            created_at: new Date(row.company.createdAt).toISOString(),
            owner_email: row.ownerEmail ?? null,
          },
          docs: docs.map((d) => ({
            id: d.id,
            doc_type: d.docType,
            file_name: d.fileName,
            is_compliant: Boolean(d.isCompliant),
            expiry_date: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0, 10) : null,
            storage_key: d.storageKey ?? null,
          })),
          tenders: tenderRows.map((t) => ({
            id: t.id,
            title: t.title,
            fit_score: t.fitScore,
            created_at: new Date(t.createdAt).toISOString(),
          })),
          credits: credit?.credits ?? 0,
          reminders: reminders.map((r) => ({
            id: r.id,
            threshold: r.threshold,
            sent_at: new Date(r.sentAt).toISOString(),
          })),
          eft: payments.map((p) => ({ id: p.id, reference: p.reference, status: p.status })),
          compliance: {
            total: docs.length,
            expired: docs.filter((d) => d.expiryDate && new Date(d.expiryDate).getTime() < nowMs)
              .length,
            compliant: docs.filter((d) => d.isCompliant).length,
          },
        });
      },
      DELETE: async ({ request, params }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const companyId = params.companyId;
        const db = createDb(env.DB);

        // Capture object keys before the DB cascade removes their rows.
        const docs = await db
          .select({ storageKey: complianceDocuments.storageKey })
          .from(complianceDocuments)
          .where(eq(complianceDocuments.companyId, companyId));
        const tenderKeys = await db
          .select({
            pdfStorageKey: tenders.pdfStorageKey,
            returnableStatus: tenders.returnableStatus,
          })
          .from(tenders)
          .where(eq(tenders.companyId, companyId));
        const proofs = await db
          .select({ proofPath: eftPayments.proofPath })
          .from(eftPayments)
          .where(eq(eftPayments.companyId, companyId));
        const keys = [
          ...docs.map((d) => d.storageKey),
          ...tenderKeys.flatMap((t) => [t.pdfStorageKey, ...returnableDocKeys(t.returnableStatus)]),
          ...proofs.map((p) => p.proofPath),
        ].filter((k): k is string => Boolean(k));

        // documents/tenders/credits/sent_reminders cascade via FK.
        const deleted = await db.delete(companies).where(eq(companies.id, companyId)).returning({
          id: companies.id,
        });
        if (deleted.length === 0) {
          return Response.json({ detail: "Company not found" }, { status: 404 });
        }
        await Promise.all(
          keys.map((key) => deleteQuietly(env.STORAGE, key, "company cascade object")),
        );

        return Response.json({
          status: "deleted",
          id: companyId,
          cascaded: { documents: docs.length, tenders: tenderKeys.length },
        });
      },
    },
  },
});
