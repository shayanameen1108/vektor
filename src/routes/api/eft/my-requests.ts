import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";

import { createDb } from "@/db";
import { eftPayments } from "@/db/schema/eft";
import { toApiEftPayment } from "@/lib/eft-api";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/eft/my-requests")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const rows = await db
          .select()
          .from(eftPayments)
          .where(eq(eftPayments.userId, session.user.id))
          .orderBy(desc(eftPayments.createdAt));
        return Response.json({ payments: rows.map(toApiEftPayment) });
      },
    },
  },
});
