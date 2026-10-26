import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";

import { createDb } from "@/db";
import { eftPayments } from "@/db/schema/eft";
import { EFT_STATUS_LABEL, type EftStatus } from "@/lib/eft";
import { toApiEftPayment } from "@/lib/eft-api";
import { requireAdmin } from "@/lib/server-auth";

/** Cap on rows returned per request — mirrors the old backend's list caps. */
const ADMIN_EFT_LIMIT = 200;

export const Route = createFileRoute("/api/eft/admin/all")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const url = new URL(request.url);
        const statusFilter = url.searchParams.get("status");

        if (statusFilter && !(statusFilter in EFT_STATUS_LABEL)) {
          return Response.json({ detail: "Invalid status filter" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const rows = statusFilter
          ? await db
              .select()
              .from(eftPayments)
              .where(eq(eftPayments.status, statusFilter as EftStatus))
              .orderBy(desc(eftPayments.createdAt))
              .limit(ADMIN_EFT_LIMIT)
          : await db
              .select()
              .from(eftPayments)
              .orderBy(desc(eftPayments.createdAt))
              .limit(ADMIN_EFT_LIMIT);
        return Response.json({ payments: rows.map(toApiEftPayment) });
      },
    },
  },
});
