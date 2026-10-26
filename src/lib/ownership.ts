import { eq } from "drizzle-orm";

import type { createDb } from "@/db";
import { companies, type CompanyRow } from "@/db/schema/company";
import { complianceDocuments, type ComplianceDocumentRow } from "@/db/schema/compliance";
import { eftPayments, type EftPaymentRow } from "@/db/schema/eft";
import { tenders, type TenderRow } from "@/db/schema/tender";
import type { AuthedSession } from "@/lib/server-auth";

/**
 * Ownership scoping shared by the API routes — the TypeScript port of
 * backend/deps.py fetch_owned_company / owned_tender_or_403 /
 * owned_document_or_403.
 *
 * Each helper returns the row when access is allowed, or a ready-to-return
 * 404/403 Response when not. Admin cross-tenant work lives on `/api/admin/*`.
 */
export type Owned<T> = T | Response;

function forbidden(): Response {
  return Response.json({ detail: "You don't have access to this company" }, { status: 403 });
}

export async function fetchOwnedCompany(
  db: ReturnType<typeof createDb>,
  companyId: string,
  session: AuthedSession,
): Promise<Owned<CompanyRow>> {
  const rows = await db.select().from(companies).where(eq(companies.id, companyId));
  const row = rows[0];
  if (!row) return Response.json({ detail: "Company not found" }, { status: 404 });
  if (row.userId !== session.user.id) return forbidden();
  return row;
}

export type OwnedTender = { tender: TenderRow; company: CompanyRow } | Response;

export async function fetchOwnedTender(
  db: ReturnType<typeof createDb>,
  tenderId: string,
  session: AuthedSession,
): Promise<OwnedTender> {
  const rows = await db.select().from(tenders).where(eq(tenders.id, tenderId));
  const tender = rows[0];
  if (!tender) return Response.json({ detail: "Tender not found" }, { status: 404 });

  const compRows = await db.select().from(companies).where(eq(companies.id, tender.companyId));
  const company = compRows[0];
  if (!company) return Response.json({ detail: "Tender not found" }, { status: 404 });
  if (company.userId !== session.user.id) {
    return Response.json({ detail: "You don't have access to this tender" }, { status: 403 });
  }
  return { tender, company };
}

export type OwnedDocument = { document: ComplianceDocumentRow; company: CompanyRow } | Response;

export async function fetchOwnedDocument(
  db: ReturnType<typeof createDb>,
  docId: string,
  session: AuthedSession,
): Promise<OwnedDocument> {
  const rows = await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, docId));
  const document = rows[0];
  if (!document) return Response.json({ detail: "Document not found" }, { status: 404 });

  const compRows = await db.select().from(companies).where(eq(companies.id, document.companyId));
  const company = compRows[0];
  if (!company) return Response.json({ detail: "Document not found" }, { status: 404 });
  if (company.userId !== session.user.id) {
    return Response.json({ detail: "You don't have access to this document" }, { status: 403 });
  }
  return { document, company };
}

export type OwnedEftPayment = { payment: EftPaymentRow } | Response;

export async function fetchOwnedEftPayment(
  db: ReturnType<typeof createDb>,
  paymentId: string,
  session: AuthedSession,
): Promise<OwnedEftPayment> {
  const rows = await db.select().from(eftPayments).where(eq(eftPayments.id, paymentId));
  const payment = rows[0];
  if (!payment) return Response.json({ detail: "Payment not found" }, { status: 404 });
  if (payment.userId !== session.user.id) {
    return Response.json({ detail: "Not your payment" }, { status: 403 });
  }
  return { payment };
}
