import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { eftPayments, type EftPaymentInsert } from "@/db/schema/eft";
import { entryByLookup } from "@/lib/billing-catalog";
import { generateReference } from "@/lib/eft";
import { toApiEftPayment } from "@/lib/eft-api";
import { fetchOwnedCompany } from "@/lib/ownership";
import { requireUser } from "@/lib/server-auth";

import { asString } from "@/lib/request-utils";

export const Route = createFileRoute("/api/eft/request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return Response.json({ detail: "Invalid JSON" }, { status: 400 });

        const lookupKey = asString(body.lookup_key);
        const companyId = asString(body.company_id);
        if (!lookupKey || !companyId) {
          return Response.json(
            { detail: "lookup_key and company_id are required" },
            { status: 400 },
          );
        }

        const entry = entryByLookup(lookupKey);
        if (!entry) return Response.json({ detail: "Unknown package" }, { status: 400 });

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, companyId, session);
        if (company instanceof Response) return company;

        // Unique reference with collision retry (unique index is the arbiter).
        let inserted: typeof eftPayments.$inferSelect | undefined;
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
          const now = new Date();
          const row: EftPaymentInsert = {
            id: crypto.randomUUID(),
            reference: generateReference(),
            userId: session.user.id,
            userEmail: session.user.email,
            companyId,
            companyName: company.companyName,
            lookupKey: entry.lookup_key,
            packageName: entry.name,
            amount: entry.amount_cents,
            credits: entry.credits,
            billingPeriod: entry.billing_period,
            type: entry.type,
            status: "awaiting_proof",
            createdAt: now,
            updatedAt: now,
          };
          try {
            const rows = await db.insert(eftPayments).values(row).returning();
            inserted = rows[0];
          } catch (e) {
            if (!(e instanceof Error && e.message.includes("UNIQUE"))) throw e;
            // reference collision — retry with a fresh one
          }
        }
        if (!inserted) {
          return Response.json(
            { detail: "Could not allocate a payment reference" },
            { status: 500 },
          );
        }
        return Response.json(toApiEftPayment(inserted), { status: 201 });
      },
    },
  },
});
