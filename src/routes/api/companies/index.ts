import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { companies } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import { claimPendingReferralRewards } from "@/lib/referral";
import { companyInputSchema, firstIssueMessage, toApiCompany } from "@/lib/company-validation";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/companies/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        // Always owner-scoped — this is the user-side list behind /setup,
        // /analyze and the dashboard. Admins keep their own companies here
        // exactly like everyone else; cross-tenant browsing lives in
        // /api/admin/companies.
        const db = createDb(env.DB);
        const rows = await db
          .select()
          .from(companies)
          .where(eq(companies.userId, session.user.id))
          .orderBy(companies.createdAt);
        return Response.json(rows.map(toApiCompany));
      },
      POST: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return Response.json({ detail: "Invalid JSON" }, { status: 400 });

        const parsed = companyInputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ detail: firstIssueMessage(parsed.error) }, { status: 400 });
        }
        const data = parsed.data;

        const now = new Date();
        const id = crypto.randomUUID();
        const db = createDb(env.DB);

        // Company + trial credits in one D1 batch so a retry after a partial
        // write cannot skip the free credits.
        await db.batch([
          db.insert(companies).values({
            id,
            userId: session.user.id,
            companyName: data.company_name,
            cipcNum: data.cipc_num,
            csdMaaaNum: data.csd_maaa_num ?? null,
            sarsTcsPin: data.sars_tcs_pin ?? null,
            cidbCrsNum: data.cidb_crs_num ?? null,
            bbbeeLevel: data.bbbee_level ?? null,
            contactEmail: data.contact_email ?? null,
            contactPhone: data.contact_phone ?? null,
            authorisedSignatoryName: data.authorised_signatory_name ?? null,
            authorisedSignatoryPosition: data.authorised_signatory_position ?? null,
            bargainingCouncils: data.bargaining_councils
              ? JSON.stringify(data.bargaining_councils)
              : null,
            preferredPppfaSystem: data.preferred_pppfa_system ?? null,
            alertsEnabled: data.alerts_enabled ?? true,
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(companyCredits).values({ companyId: id, credits: 5, updatedAt: now }),
        ]);

        try {
          await claimPendingReferralRewards(
            db,
            { referrerUserId: session.user.id, referrerCompanyId: id },
            env.DB,
          );
        } catch (error) {
          console.error("Failed to claim pending referral rewards", error);
        }

        const created = (await db.select().from(companies).where(eq(companies.id, id)))[0]!;
        return Response.json(toApiCompany(created), { status: 201 });
      },
    },
  },
});
