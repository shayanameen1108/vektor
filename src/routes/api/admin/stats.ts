import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { user } from "@/db/schema/auth";
import { complianceDocuments } from "@/db/schema/compliance";
import { companies } from "@/db/schema/company";
import { eftPayments } from "@/db/schema/eft";
import { tenders } from "@/db/schema/tender";
import { requireAdmin } from "@/lib/server-auth";

export const Route = createFileRoute("/api/admin/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const db = createDb(env.DB);

        const [usersTotal, adminsTotal, companiesTotal, tendersTotal, docsTotal, pendingReview] =
          await Promise.all([
            db.$count(user),
            db.$count(user, eq(user.role, "admin")),
            db.$count(companies),
            db.$count(tenders),
            db.$count(complianceDocuments),
            db.$count(eftPayments, eq(eftPayments.status, "pending_review")),
          ]);

        return Response.json({
          users: { total: usersTotal, admins: adminsTotal },
          companies: { total: companiesTotal },
          tenders: { total: tendersTotal },
          documents: { total: docsTotal },
          eft: { pending_review: pendingReview },
        });
      },
    },
  },
});
