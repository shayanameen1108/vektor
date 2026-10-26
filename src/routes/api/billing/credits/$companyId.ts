import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { companyCredits } from "@/db/schema/credits";
import { fetchOwnedCompany } from "@/lib/ownership";
import type { SubscriptionDto } from "@/lib/queries";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/billing/credits/$companyId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, params.companyId, session);
        if (company instanceof Response) return company;

        const rows = await db
          .select()
          .from(companyCredits)
          .where(eq(companyCredits.companyId, params.companyId));
        const row = rows[0];

        const subscription: SubscriptionDto | null = row?.subscriptionLookupKey
          ? {
              lookup_key: row.subscriptionLookupKey,
              active: Boolean(row.subscriptionActive),
              cycle_credits: row.subscriptionCycleCredits ?? null,
              rollover_cap: row.subscriptionRolloverCap ?? null,
              started_at: row.subscriptionStartedAt
                ? new Date(row.subscriptionStartedAt).toISOString()
                : null,
            }
          : null;

        return Response.json({
          company_id: params.companyId,
          credits: row?.credits ?? 0,
          subscription,
        });
      },
    },
  },
});
