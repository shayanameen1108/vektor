import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { companies } from "@/db/schema/company";
import {
  nullIfBlank,
  toApiCompany,
  validateCouncils,
  validatePppfa,
  validateStatutoryFields,
} from "@/lib/company-validation";
import { fetchOwnedCompany } from "@/lib/ownership";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/companies/$companyId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return Response.json({ detail: "Invalid JSON" }, { status: 400 });

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, params.companyId, session);
        if (company instanceof Response) return company;

        // Only apply keys the client actually sent — partial updates never wipe
        // unrelated fields, and explicit nulls clear optional statutory fields.
        const updates: Record<string, unknown> = {};
        const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
        try {
          Object.assign(updates, validateStatutoryFields(body));
        } catch (e) {
          return Response.json(
            { detail: e instanceof Error ? e.message : "Invalid statutory fields" },
            { status: 400 },
          );
        }
        const textFields = [
          "company_name",
          "cidb_crs_num",
          "contact_email",
          "contact_phone",
          "authorised_signatory_name",
          "authorised_signatory_position",
        ] as const;

        for (const field of textFields) {
          if (!has(field)) continue;
          if (
            field === "company_name" &&
            typeof body[field] === "string" &&
            body[field].trim() === ""
          ) {
            return Response.json({ detail: `${field} cannot be empty` }, { status: 400 });
          }
          const column = field
            .split("_")
            .map((p, i) => (i === 0 ? p : p[0]!.toUpperCase() + p.slice(1)))
            .join("");
          updates[column] =
            field === "company_name" ? String(body[field]).trim() : nullIfBlank(body[field]);
        }

        if (has("bbbee_level")) {
          if (body.bbbee_level == null || body.bbbee_level === "") {
            updates.bbbeeLevel = null;
          } else {
            const n = Number(body.bbbee_level);
            if (!Number.isInteger(n) || n < 1 || n > 8) {
              return Response.json(
                { detail: "bbbee_level must be between 1 and 8" },
                { status: 400 },
              );
            }
            updates.bbbeeLevel = n;
          }
        }

        if (has("bargaining_councils")) {
          try {
            const validated = validateCouncils(body.bargaining_councils);
            updates.bargainingCouncils = validated ? JSON.stringify(validated) : null;
          } catch (e) {
            return Response.json(
              { detail: e instanceof Error ? e.message : "Invalid bargaining councils" },
              { status: 400 },
            );
          }
        }

        if (has("preferred_pppfa_system")) {
          try {
            updates.preferredPppfaSystem = validatePppfa(body.preferred_pppfa_system);
          } catch (e) {
            return Response.json(
              { detail: e instanceof Error ? e.message : "Invalid PPPFA preference system" },
              { status: 400 },
            );
          }
        }

        if (has("alerts_enabled")) {
          updates.alertsEnabled = Boolean(body.alerts_enabled);
        }

        if (Object.keys(updates).length === 0) {
          return Response.json(toApiCompany(company));
        }

        updates.updatedAt = new Date();
        await db.update(companies).set(updates).where(eq(companies.id, params.companyId));
        const updated = (
          await db.select().from(companies).where(eq(companies.id, params.companyId))
        )[0]!;
        return Response.json(toApiCompany(updated));
      },
    },
  },
});
