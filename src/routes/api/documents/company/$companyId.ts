import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";

import { createDb } from "@/db";
import { complianceDocuments } from "@/db/schema/compliance";
import { toApiDoc } from "@/lib/document-api";
import { fetchOwnedCompany } from "@/lib/ownership";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/documents/company/$companyId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, params.companyId, session);
        if (company instanceof Response) return company;

        const docs = await db
          .select()
          .from(complianceDocuments)
          .where(eq(complianceDocuments.companyId, params.companyId))
          .orderBy(desc(complianceDocuments.createdAt));
        return Response.json(docs.map(toApiDoc));
      },
    },
  },
});
