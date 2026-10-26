import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq, ne } from "drizzle-orm";

import { createDb } from "@/db";
import { complianceDocuments, sentReminders } from "@/db/schema/compliance";
import {
  isBcGos,
  NEEDS_EXPIRY_TYPES,
  type DocType,
  validateBargainingCouncil,
} from "@/lib/compliance";
import { toApiDoc } from "@/lib/document-api";
import { deleteQuietly } from "@/lib/r2-response";
import { fetchOwnedDocument } from "@/lib/ownership";
import { requireUser } from "@/lib/server-auth";

import { asString } from "@/lib/request-utils";

export const Route = createFileRoute("/api/documents/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const owned = await fetchOwnedDocument(db, params.id, session);
        if (owned instanceof Response) return owned;
        const { document } = owned;

        await db.batch([
          db.delete(sentReminders).where(eq(sentReminders.documentId, document.id)),
          db.delete(complianceDocuments).where(eq(complianceDocuments.id, document.id)),
        ]);
        if (document.storageKey) {
          await deleteQuietly(env.STORAGE, document.storageKey, "compliance document");
        }

        return Response.json({ status: "deleted", id: document.id });
      },
      PATCH: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return Response.json({ detail: "Invalid JSON" }, { status: 400 });

        const db = createDb(env.DB);
        const owned = await fetchOwnedDocument(db, params.id, session);
        if (owned instanceof Response) return owned;
        const { document } = owned;

        const updates: Record<string, unknown> = {};
        if (Object.prototype.hasOwnProperty.call(body, "expiry_date")) {
          const raw = asString(body.expiry_date).trim();
          if (!raw) {
            if (NEEDS_EXPIRY_TYPES.has(document.docType as DocType)) {
              return Response.json(
                { detail: "expiry_date is required for this document type" },
                { status: 400 },
              );
            }
            updates.expiryDate = null;
          } else {
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) {
              return Response.json({ detail: "Invalid expiry_date" }, { status: 400 });
            }
            updates.expiryDate = d;
          }
        }

        if (Object.prototype.hasOwnProperty.call(body, "is_compliant")) {
          updates.isCompliant = Boolean(body.is_compliant);
        }

        if (
          Object.prototype.hasOwnProperty.call(body, "bargaining_council") &&
          isBcGos(document.docType)
        ) {
          try {
            const council = validateBargainingCouncil(
              document.docType,
              typeof body.bargaining_council === "string" ? body.bargaining_council : null,
            );
            updates.bargainingCouncil = council;
            updates.scopeKey = council ?? "";
          } catch (e) {
            return Response.json(
              { detail: e instanceof Error ? e.message : "Invalid bargaining council" },
              { status: 400 },
            );
          }
        }

        if (Object.keys(updates).length === 0) {
          return Response.json(toApiDoc(document));
        }

        if (typeof updates.scopeKey === "string") {
          const conflict = await db
            .select({ id: complianceDocuments.id })
            .from(complianceDocuments)
            .where(
              and(
                eq(complianceDocuments.companyId, document.companyId),
                eq(complianceDocuments.docType, document.docType),
                eq(complianceDocuments.scopeKey, updates.scopeKey),
                ne(complianceDocuments.id, document.id),
              ),
            )
            .limit(1);
          if (conflict.length > 0) {
            return Response.json(
              { detail: "A document already exists for that bargaining council" },
              { status: 409 },
            );
          }
        }

        updates.updatedAt = new Date();
        // Renewing the expiry (or flipping compliance back on) must re-arm the
        // reminder schedule — the same rule the upload path applies when it
        // replaces a document.
        try {
          if ("expiryDate" in updates || "isCompliant" in updates) {
            await db.batch([
              db.delete(sentReminders).where(eq(sentReminders.documentId, document.id)),
              db
                .update(complianceDocuments)
                .set(updates)
                .where(eq(complianceDocuments.id, document.id)),
            ]);
          } else {
            await db
              .update(complianceDocuments)
              .set(updates)
              .where(eq(complianceDocuments.id, document.id));
          }
        } catch (error) {
          if (
            "scopeKey" in updates &&
            error instanceof Error &&
            (error.message.includes("compliance_company_type_scope_unique") ||
              error.message.includes("UNIQUE constraint failed"))
          ) {
            return Response.json(
              { detail: "A document already exists for that bargaining council" },
              { status: 409 },
            );
          }
          throw error;
        }

        const updated = (
          await db.select().from(complianceDocuments).where(eq(complianceDocuments.id, document.id))
        )[0]!;
        return Response.json(toApiDoc(updated));
      },
    },
  },
});
