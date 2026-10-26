import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { companies } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import { claimPendingReferralRewards } from "@/lib/referral";
import {
  nullIfBlank,
  toApiCompany,
  validateCouncils,
  validatePppfa,
  validateStatutoryFields,
} from "@/lib/company-validation";
import { requireUser } from "@/lib/server-auth";

import { asString } from "@/lib/request-utils";

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

        const companyName = asString(body.company_name).trim();
        if (!companyName) {
          return Response.json({ detail: "Company name is required" }, { status: 400 });
        }

        let statutory;
        try {
          statutory = validateStatutoryFields(body, { requireCipc: true });
        } catch (e) {
          return Response.json(
            { detail: e instanceof Error ? e.message : "Invalid statutory fields" },
            { status: 400 },
          );
        }

        let bbbeeLevel: number | null = null;
        if (body.bbbee_level != null && body.bbbee_level !== "") {
          const n = Number(body.bbbee_level);
          if (!Number.isInteger(n) || n < 1 || n > 8) {
            return Response.json(
              { detail: "bbbee_level must be between 1 and 8" },
              { status: 400 },
            );
          }
          bbbeeLevel = n;
        }

        let bargainingCouncils: string[] | null;
        try {
          bargainingCouncils = validateCouncils(body.bargaining_councils);
        } catch (e) {
          return Response.json(
            { detail: e instanceof Error ? e.message : "Invalid bargaining councils" },
            { status: 400 },
          );
        }

        let preferredPppfa: string | null;
        try {
          preferredPppfa = validatePppfa(body.preferred_pppfa_system);
        } catch (e) {
          return Response.json(
            { detail: e instanceof Error ? e.message : "Invalid PPPFA preference system" },
            { status: 400 },
          );
        }

        const now = new Date();
        const id = crypto.randomUUID();
        const db = createDb(env.DB);

        // Company + trial credits in one D1 batch so a retry after a partial
        // write cannot skip the free credits.
        await db.batch([
          db.insert(companies).values({
            id,
            userId: session.user.id,
            companyName,
            cipcNum: statutory.cipcNum!,
            csdMaaaNum: statutory.csdMaaaNum ?? null,
            sarsTcsPin: statutory.sarsTcsPin ?? null,
            cidbCrsNum: nullIfBlank(body.cidb_crs_num),
            bbbeeLevel,
            contactEmail: nullIfBlank(body.contact_email),
            contactPhone: nullIfBlank(body.contact_phone),
            authorisedSignatoryName: nullIfBlank(body.authorised_signatory_name),
            authorisedSignatoryPosition: nullIfBlank(body.authorised_signatory_position),
            bargainingCouncils: bargainingCouncils ? JSON.stringify(bargainingCouncils) : null,
            preferredPppfaSystem: preferredPppfa,
            alertsEnabled: body.alerts_enabled !== false,
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
