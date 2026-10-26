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
import { deleteQuietly } from "@/lib/r2-response";
import { returnableDocKeys } from "@/lib/tender-returnables";

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

        if (params.userId === adminCheck.user.id) {
          return Response.json({ detail: "You cannot delete yourself" }, { status: 400 });
        }

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const reason = asString(body?.reason ?? "").trim();
        const confirmEmail = asString(body?.confirm_email ?? "")
          .trim()
          .toLowerCase();
        if (!reason) {
          return Response.json({ detail: "A reason is required for deletion" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const target = (await db.select().from(user).where(eq(user.id, params.userId)))[0];
        if (!target) return Response.json({ detail: "User not found" }, { status: 404 });
        if (target.role === "admin") {
          return Response.json({ detail: "Cannot delete an admin account" }, { status: 400 });
        }
        if (!confirmEmail || confirmEmail !== target.email.toLowerCase()) {
          return Response.json(
            { detail: "Confirmation email doesn't match target user's email" },
            { status: 400 },
          );
        }

        // Collect R2 keys before the cascade removes the rows.
        const ownedCompanies = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.userId, params.userId));
        const companyIds = ownedCompanies.map((c) => c.id);

        const keys: string[] = [];
        if (companyIds.length > 0) {
          const docs = await db
            .select({ storageKey: complianceDocuments.storageKey })
            .from(complianceDocuments)
            .where(inArray(complianceDocuments.companyId, companyIds));
          const tenderKeys = await db
            .select({
              pdfStorageKey: tenders.pdfStorageKey,
              returnableStatus: tenders.returnableStatus,
            })
            .from(tenders)
            .where(inArray(tenders.companyId, companyIds));
          for (const k of docs) if (k.storageKey) keys.push(k.storageKey);
          for (const tender of tenderKeys) {
            if (tender.pdfStorageKey) keys.push(tender.pdfStorageKey);
            keys.push(...returnableDocKeys(tender.returnableStatus));
          }
        }
        const proofs = await db
          .select({ proofPath: eftPayments.proofPath })
          .from(eftPayments)
          .where(eq(eftPayments.userId, params.userId));
        for (const k of proofs) if (k.proofPath) keys.push(k.proofPath);

        // All child rows (sessions, accounts, companies → documents/tenders/
        // credits/reminders, EFT payments, referrals, rewards) carry
        // ON DELETE CASCADE foreign keys back to user.
        await db.delete(user).where(eq(user.id, params.userId));
        await Promise.all(
          keys.map((key) => deleteQuietly(env.STORAGE, key, "user cascade object")),
        );

        return Response.json({ status: "deleted", user_id: params.userId, email: target.email });
      },
    },
  },
});
