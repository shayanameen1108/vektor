import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";

import { createDb } from "@/db";
import { user } from "@/db/schema/auth";
import { complianceDocuments, sentReminders } from "@/db/schema/compliance";
import { companies } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import { eftPayments } from "@/db/schema/eft";
import { referrals, referralRewards } from "@/db/schema/referral";
import { tenders } from "@/db/schema/tender";
import { requireAdmin } from "@/lib/server-auth";
import { deleteUserCascade } from "@/lib/user-admin";

import { asString } from "@/lib/request-utils";

export const Route = createFileRoute("/api/admin/users/$userId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const db = createDb(env.DB);
        const target = (await db.select().from(user).where(eq(user.id, params.userId)))[0];
        if (!target) return Response.json({ detail: "User not found" }, { status: 404 });

        // Everything the admin drill-down shows: owned companies with their
        // compliance state, tender/credit/reminder history, EFT and referrals.
        const ownedCompanies = await db
          .select()
          .from(companies)
          .where(eq(companies.userId, params.userId));
        const companyIds = ownedCompanies.map((c) => c.id);

        const docs =
          companyIds.length > 0
            ? await db
                .select()
                .from(complianceDocuments)
                .where(inArray(complianceDocuments.companyId, companyIds))
            : [];
        const userTenders =
          companyIds.length > 0
            ? await db.select().from(tenders).where(inArray(tenders.companyId, companyIds))
            : [];
        const payments = await db
          .select()
          .from(eftPayments)
          .where(eq(eftPayments.userId, params.userId));

        const creditRows =
          companyIds.length > 0
            ? await db
                .select()
                .from(companyCredits)
                .where(inArray(companyCredits.companyId, companyIds))
            : [];
        const reminderRows =
          companyIds.length > 0
            ? await db
                .select()
                .from(sentReminders)
                .where(inArray(sentReminders.companyId, companyIds))
            : [];
        const userReferrals = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referrerUserId, params.userId));
        const rewards = await db
          .select()
          .from(referralRewards)
          .where(eq(referralRewards.referrerUserId, params.userId));

        const nowMs = Date.now();
        return Response.json({
          user: {
            id: target.id,
            name: target.name,
            email: target.email,
            role: target.role,
            referral_code: target.referralCode,
            referred_by_code: target.referredByCode,
            email_verified: target.emailVerified,
            banned: target.banned,
            created_at: new Date(target.createdAt).toISOString(),
          },
          companies: ownedCompanies.map((c) => ({
            id: c.id,
            company_name: c.companyName,
            cipc_num: c.cipcNum,
            bbbee_level: c.bbbeeLevel,
            cidb_crs_num: c.cidbCrsNum,
            created_at: new Date(c.createdAt).toISOString(),
          })),
          compliance: {
            total: docs.length,
            compliant: docs.filter((d) => d.isCompliant).length,
            expired: docs.filter((d) => d.expiryDate && new Date(d.expiryDate).getTime() < nowMs)
              .length,
            docs: docs.map((d) => ({
              id: d.id,
              doc_type: d.docType,
              file_name: d.fileName,
              expiry_date: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0, 10) : null,
              is_compliant: Boolean(d.isCompliant),
            })),
          },
          tenders: {
            total: userTenders.length,
            items: userTenders.slice(0, 20).map((t) => ({
              id: t.id,
              title: t.title,
              fit_score: t.fitScore,
              created_at: new Date(t.createdAt).toISOString(),
            })),
          },
          credits: creditRows.map((c) => ({
            company_id: c.companyId,
            credits: c.credits,
          })),
          eft: {
            total: payments.length,
            payments: payments.slice(0, 20).map((p) => ({
              id: p.id,
              reference: p.reference,
              status: p.status,
              amount: p.amount / 100,
              credits: p.credits,
              created_at: new Date(p.createdAt).toISOString(),
            })),
          },
          reminders: {
            total: reminderRows.length,
          },
          referrals: {
            total: userReferrals.length,
          },
          referral_rewards: {
            total: rewards.length,
            credits_earned: rewards.reduce((s, r) => s + r.creditsGranted, 0),
          },
        });
      },
      DELETE: async ({ request, params }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const reason = asString(body?.reason ?? "").trim();
        const confirmEmail = asString(body?.confirm_email ?? "")
          .trim()
          .toLowerCase();

        const outcome = await deleteUserCascade(createDb(env.DB), env.STORAGE, {
          adminUserId: adminCheck.user.id,
          targetUserId: params.userId,
          reason,
          confirmEmail,
        });
        if (!outcome.ok) {
          return Response.json({ detail: outcome.detail }, { status: outcome.status });
        }
        return Response.json({ status: "deleted", user_id: params.userId, email: outcome.email });
      },
    },
  },
});
