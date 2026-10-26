import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";

import { createDb } from "@/db";
import { tenders } from "@/db/schema/tender";
import { fetchOwnedCompany } from "@/lib/ownership";
import { toApiTender } from "@/lib/tender-api";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/tenders/$companyId")({
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
          .from(tenders)
          .where(eq(tenders.companyId, params.companyId))
          .orderBy(desc(tenders.createdAt));
        return Response.json(rows.map(toApiTender));
      },
    },
  },
});
