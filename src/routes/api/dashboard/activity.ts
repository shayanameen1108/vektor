import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { desc, eq, inArray } from "drizzle-orm";

import { createDb } from "@/db";
import { companies } from "@/db/schema/company";
import { eftPayments } from "@/db/schema/eft";
import { referralRewards } from "@/db/schema/referral";
import { tenders } from "@/db/schema/tender";
import { verdictFromScore } from "@/lib/tender-scoring";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/dashboard/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const url = new URL(request.url);
        const typeFilter = url.searchParams.get("type");
        if (typeFilter && !["tender", "eft", "referral_reward"].includes(typeFilter)) {
          return Response.json({ detail: "Invalid type filter" }, { status: 400 });
        }
        const rawLimit = url.searchParams.get("limit");
        let limit = 10;
        if (rawLimit) {
          const parsed = Number.parseInt(rawLimit, 10);
          if (!Number.isNaN(parsed)) limit = Math.min(50, Math.max(1, parsed));
        }

        const wantTender = !typeFilter || typeFilter === "tender";
        const wantEft = !typeFilter || typeFilter === "eft";
        const wantReward = !typeFilter || typeFilter === "referral_reward";

        const db = createDb(env.DB);
        const userId = session.user.id;

        // Tender analyses across all the user's companies.
        let tenderItems: Record<string, unknown>[] = [];
        if (wantTender) {
          const owned = await db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.userId, userId));
          const companyIds = owned.map((c) => c.id);
          if (companyIds.length > 0) {
            const rows = await db
              .select()
              .from(tenders)
              .where(inArray(tenders.companyId, companyIds))
              .orderBy(desc(tenders.createdAt))
              .limit(limit);
            tenderItems = rows.map((t) => ({
              type: "tender",
              id: t.id,
              created_at: new Date(t.createdAt).toISOString(),
              title: t.title || "Untitled tender",
              issuing_entity: t.issuingEntity,
              fit_score: t.fitScore,
              verdict: verdictFromScore(t.fitScore),
              company_id: t.companyId,
            }));
          }
        }

        // EFT payments the user has raised.
        let eftItems: Record<string, unknown>[] = [];
        if (wantEft) {
          const rows = await db
            .select()
            .from(eftPayments)
            .where(eq(eftPayments.userId, userId))
            .orderBy(desc(eftPayments.createdAt))
            .limit(limit);
          eftItems = rows.map((p) => ({
            type: "eft",
            id: p.id,
            created_at: new Date(p.createdAt).toISOString(),
            reference: p.reference,
            plan_name: p.packageName,
            amount: p.amount / 100,
            status: p.status,
            credits_granted: p.creditsGranted,
            confirmed_at: p.confirmedAt ? new Date(p.confirmedAt).toISOString() : null,
          }));
        }

        // Referral rewards earned (referrer-only program).
        let rewardItems: Record<string, unknown>[] = [];
        if (wantReward) {
          const rows = await db
            .select()
            .from(referralRewards)
            .where(eq(referralRewards.referrerUserId, userId))
            .orderBy(desc(referralRewards.createdAt))
            .limit(limit);
          rewardItems = rows.map((r) => ({
            type: "referral_reward",
            id: r.id,
            created_at: new Date(r.createdAt).toISOString(),
            credits_granted: r.creditsGranted,
            plan_lookup_key: r.planLookupKey,
            trigger_reference: r.triggerReference,
          }));
        }

        // Merge into one timestamp-sorted timeline and trim to `limit`.
        const merged = [...tenderItems, ...eftItems, ...rewardItems]
          .sort((a, b) => {
            const aTime = new Date((a.created_at as string) || 0).getTime();
            const bTime = new Date((b.created_at as string) || 0).getTime();
            return bTime - aTime;
          })
          .slice(0, limit);

        return Response.json({
          items: merged,
          counts: {
            tenders: tenderItems.length,
            eft: eftItems.length,
            referral_rewards: rewardItems.length,
          },
        });
      },
    },
  },
});
