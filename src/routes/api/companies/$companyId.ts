import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { companies } from "@/db/schema/company";
import {
  companyPatchSchema,
  companyPatchUpdates,
  firstIssueMessage,
  toApiCompany,
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

        // Only keys the client actually sent apply — partial updates never
        // wipe unrelated fields, and explicit nulls clear optional fields.
        const parsed = companyPatchSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ detail: firstIssueMessage(parsed.error) }, { status: 400 });
        }
        const updates = companyPatchUpdates(parsed.data);
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
