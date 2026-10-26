import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { desc, like, or, sql } from "drizzle-orm";

import { createDb } from "@/db";
import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/company";
import { requireAdmin } from "@/lib/server-auth";

/**
 * Cap on rows returned per request — mirrors the old backend's `.to_list(100)`
 * list caps. The console is a working queue, not an export; the search box
 * narrows within the returned window.
 */
const ADMIN_USERS_LIMIT = 100;

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();

        const db = createDb(env.DB);
        const rows = await db
          .select()
          .from(user)
          .where(
            q
              ? or(
                  like(sql`lower(${user.email})`, `%${q.toLowerCase()}%`),
                  like(sql`lower(coalesce(${user.name}, ''))`, `%${q.toLowerCase()}%`),
                  // User ids are case-sensitive nanoids — match them raw.
                  like(user.id, `%${q}%`),
                )
              : undefined,
          )
          .orderBy(desc(user.createdAt))
          .limit(ADMIN_USERS_LIMIT);

        // company counts per user (single grouped query)
        const counts = await db
          .select({ userId: companies.userId, n: sql<number>`count(*)` })
          .from(companies)
          .groupBy(companies.userId);
        const countByUser = new Map(counts.map((c) => [c.userId, Number(c.n)]));

        return Response.json(
          rows.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            referral_code: u.referralCode,
            referred_by_user_id: u.referredByUserId,
            referred_by_code: u.referredByCode,
            email_verified: u.emailVerified,
            banned: u.banned,
            ban_reason: u.banReason,
            created_at: new Date(u.createdAt).toISOString(),
            updated_at: new Date(u.updatedAt).toISOString(),
            company_count: countByUser.get(u.id) ?? 0,
          })),
        );
      },
    },
  },
});
