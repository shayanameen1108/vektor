/**
 * Referral domain — ported from backend/referral_service.py.
 * Referrer-only credits: referee gets 0, referrer earns on the invitee's
 * first paid subscription EFT confirmed by an admin.
 *
 * Guardrails (verbatim from the old service):
 *   - first code wins (a user can be referred only once)
 *   - self-referral blocked
 *   - rewards gated behind admin EFT confirmation
 *   - max 5 rewards per referrer per calendar month (UTC), 20 lifetime
 *
 * If the referrer has no company at reward time, the reward is parked on the
 * referrals row (pending_referrer_company) rather than failing the confirm.
 */

import { and, eq, gte, isNull, sql } from "drizzle-orm";

import type { createDb } from "@/db";
import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/company";
import { referrals, referralRewards, type ReferralRow } from "@/db/schema/referral";
import { generateReference } from "@/lib/eft";

export const TIER_REWARDS: Record<string, number> = {
  tc_starter_monthly_v2: 3,
  tc_pro_monthly_v2: 5,
  tc_scale_monthly_v2: 10,
};
export const MONTHLY_REWARD_CAP = 5;
export const LIFETIME_REWARD_CAP = 20;
export const REFEREE_SIGNUP_BONUS = 0;

export function isSelfReferral(
  referrer: { id: string; email: string },
  referee: { id: string; email: string },
): boolean {
  return (
    referrer.id === referee.id ||
    referrer.email.trim().toLowerCase() === referee.email.trim().toLowerCase()
  );
}

export function rewardForPlan(lookupKey: string | null | undefined): number {
  if (!lookupKey) return 0;
  return TIER_REWARDS[lookupKey] ?? 0;
}

/**
 * Ensure the user has a unique VEK-XXXXXX referral code. Idempotent;
 * retries up to 5 times on collision (unique index is the arbiter).
 */
export async function ensureReferralCode(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<string> {
  const rows = await db.select().from(user).where(eq(user.id, userId));
  const existing = rows[0];
  if (!existing) throw new Error("User not found");
  if (existing.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReference();
    try {
      await db
        .update(user)
        .set({ referralCode: code, updatedAt: new Date() })
        .where(and(eq(user.id, userId), sql`${user.referralCode} IS NULL`));
      // Read back to detect the rare race where another isolate won the code.
      const after = await db
        .select({ referralCode: user.referralCode })
        .from(user)
        .where(eq(user.id, userId));
      const assigned = after[0]?.referralCode;
      if (assigned) return assigned;
    } catch {
      // unique violation on referralCode — retry with a fresh code
    }
  }
  throw new Error("Could not generate a unique referral code");
}

interface ReferrerPreview {
  referrer_first_name: string;
  referrer_company?: string | null;
  signup_bonus_credits: number;
}

/** Public lookup — only exposes first name + company, never email or id. */
export async function lookupReferrer(
  db: ReturnType<typeof createDb>,
  refCode: string,
): Promise<ReferrerPreview | null> {
  const normalized = (refCode || "").trim().toUpperCase();
  if (!normalized) return null;

  const referrerRows = await db.select().from(user).where(eq(user.referralCode, normalized));
  const referrer = referrerRows[0];
  if (!referrer) return null;

  const companyRows = await db
    .select()
    .from(companies)
    .where(eq(companies.userId, referrer.id))
    .orderBy(companies.createdAt);
  const company = companyRows[0];

  const rawName = (referrer.name || referrer.email.split("@")[0] || "").split(" ")[0] || "";
  return {
    referrer_first_name: rawName.trim() || "A Vektor user",
    referrer_company: company?.companyName ?? null,
    signup_bonus_credits: REFEREE_SIGNUP_BONUS,
  };
}

/**
 * Store the referral link at signup time. Returns the referrer's user id when
 * attribution succeeded; unknown codes, self-referrals and duplicate claims
 * are ignored (no error).
 */
export async function recordSignup(
  db: ReturnType<typeof createDb>,
  refereeUserId: string,
  refereeEmail: string,
  refCode: string,
  d1: D1Database = db.$client,
): Promise<string | null> {
  const normalized = (refCode || "").trim().toUpperCase();
  if (!normalized) return null;

  const referrer = (await db.select().from(user).where(eq(user.referralCode, normalized)))[0];
  if (!referrer) return null;
  if (
    isSelfReferral(referrer, {
      id: refereeUserId,
      email: refereeEmail,
    })
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    const results = await d1.batch([
      d1
        .prepare(
          `UPDATE user SET referredByUserId = ?, referredByCode = ?, referredAt = ?, updatedAt = ?
         WHERE id = ? AND referredByUserId IS NULL`,
        )
        .bind(referrer.id, normalized, now, now, refereeUserId),
      d1
        .prepare(
          `INSERT INTO referrals
          (id, referrerUserId, refereeUserId, refereeEmail, code, status,
           signupBonusGranted, referrerFirstPaidBonusGranted, referrerSubBonusGranted, createdAt)
         SELECT ?, ?, id, ?, ?, 'signed_up', 0, 0, 0, ?
         FROM user WHERE id = ? AND referredByUserId = ? AND referredByCode = ?`,
        )
        .bind(
          crypto.randomUUID(),
          referrer.id,
          refereeEmail.toLowerCase(),
          normalized,
          now,
          refereeUserId,
          referrer.id,
          normalized,
        ),
    ]);
    return Number(results[0]!.meta.changes ?? 0) === 1 ? referrer.id : null;
  } catch {
    return null;
  }
}

async function rewardsUsedThisMonth(
  db: ReturnType<typeof createDb>,
  referrerId: string,
): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(referralRewards)
    .where(
      and(
        eq(referralRewards.referrerUserId, referrerId),
        gte(referralRewards.createdAt, monthStart),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

async function rewardsUsedLifetime(
  db: ReturnType<typeof createDb>,
  referrerId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(referralRewards)
    .where(eq(referralRewards.referrerUserId, referrerId));
  return Number(rows[0]?.count ?? 0);
}

interface RewardResult {
  granted: boolean;
  credits?: number;
  referrer_user_id?: string;
  plan_lookup_key?: string | null;
  type?: string;
  reason?: string;
}

async function grantReferralReward(
  db: ReturnType<typeof createDb>,
  ref: ReferralRow,
  args: {
    referrerCompanyId: string;
    creditsToGrant: number;
    planLookupKey: string | null;
    triggerReference: string | null;
  },
  d1: D1Database,
): Promise<RewardResult | null> {
  const { referrerCompanyId, creditsToGrant, planLookupKey, triggerReference } = args;
  const now = Math.floor(Date.now() / 1000);
  const monthStartDate = new Date();
  monthStartDate.setUTCDate(1);
  monthStartDate.setUTCHours(0, 0, 0, 0);
  const monthStart = Math.floor(monthStartDate.getTime() / 1000);
  const token = crypto.randomUUID();
  try {
    const results = await d1.batch([
      d1
        .prepare(
          `UPDATE referrals SET rewardClaimToken = ?
         WHERE id = ? AND referrerFirstPaidBonusGranted = 0 AND rewardClaimToken IS NULL
           AND (SELECT count(*) FROM referral_rewards WHERE referrerUserId = ?) < ?
           AND (SELECT count(*) FROM referral_rewards WHERE referrerUserId = ? AND createdAt >= ?) < ?`,
        )
        .bind(
          token,
          ref.id,
          ref.referrerUserId,
          LIFETIME_REWARD_CAP,
          ref.referrerUserId,
          monthStart,
          MONTHLY_REWARD_CAP,
        ),
      d1
        .prepare(
          `INSERT INTO company_credits (companyId, credits, subscriptionActive, updatedAt)
         SELECT ?, ?, 0, ? FROM referrals WHERE id = ? AND rewardClaimToken = ?
         ON CONFLICT(companyId) DO UPDATE SET
           credits = company_credits.credits + excluded.credits, updatedAt = excluded.updatedAt`,
        )
        .bind(referrerCompanyId, creditsToGrant, now, ref.id, token),
      d1
        .prepare(
          `INSERT INTO referral_rewards
          (id, referrerUserId, refereeUserId, referrerCompanyId, creditsGranted, type,
           planLookupKey, triggerReference, createdAt)
         SELECT ?, referrerUserId, refereeUserId, ?, ?, 'first_paid_subscription', ?, ?, ?
         FROM referrals WHERE id = ? AND rewardClaimToken = ?`,
        )
        .bind(
          crypto.randomUUID(),
          referrerCompanyId,
          creditsToGrant,
          planLookupKey,
          triggerReference,
          now,
          ref.id,
          token,
        ),
      d1
        .prepare(
          `UPDATE referrals SET status = 'first_paid_subscription',
           referrerFirstPaidBonusGranted = 1, referrerSubBonusGranted = 1,
           firstPaidAt = ?, firstPaidPlanLookupKey = ?, rewardClaimToken = NULL,
           pendingReferrerCredits = NULL, pendingPlanLookupKey = NULL,
           pendingTriggerReference = NULL
         WHERE id = ? AND rewardClaimToken = ?`,
        )
        .bind(now, planLookupKey, ref.id, token),
    ]);
    if (Number(results[0]!.meta.changes ?? 0) !== 1) {
      const lifetime = await rewardsUsedLifetime(db, ref.referrerUserId);
      const monthly = await rewardsUsedThisMonth(db, ref.referrerUserId);
      if (lifetime >= LIFETIME_REWARD_CAP || monthly >= MONTHLY_REWARD_CAP) {
        const reason = lifetime >= LIFETIME_REWARD_CAP ? "lifetime_cap" : "monthly_cap";
        await db
          .update(referrals)
          .set({ status: "capped", cappedAt: new Date(), capReason: reason.replace("_cap", "") })
          .where(and(eq(referrals.id, ref.id), eq(referrals.referrerFirstPaidBonusGranted, false)));
        return { granted: false, reason };
      }
      return null;
    }
  } catch (error) {
    const durable = (await db.select().from(referrals).where(eq(referrals.id, ref.id)))[0];
    if (durable?.referrerFirstPaidBonusGranted) return null;
    throw error;
  }

  return {
    granted: true,
    credits: creditsToGrant,
    referrer_user_id: ref.referrerUserId,
    plan_lookup_key: planLookupKey,
    type: "first_paid_subscription",
  };
}

/** Claim all rewards parked while a referrer had no company. */
export async function claimPendingReferralRewards(
  db: ReturnType<typeof createDb>,
  args: { referrerUserId: string; referrerCompanyId: string },
  d1: D1Database = db.$client,
): Promise<RewardResult[]> {
  const pending = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, args.referrerUserId),
        eq(referrals.status, "pending_referrer_company"),
        eq(referrals.referrerFirstPaidBonusGranted, false),
      ),
    )
    .orderBy(referrals.createdAt);
  const results: RewardResult[] = [];

  for (const ref of pending) {
    if (!ref.pendingReferrerCredits || !ref.pendingPlanLookupKey) continue;
    const result = await grantReferralReward(
      db,
      ref,
      {
        referrerCompanyId: args.referrerCompanyId,
        creditsToGrant: ref.pendingReferrerCredits,
        planLookupKey: ref.pendingPlanLookupKey,
        triggerReference: ref.pendingTriggerReference,
      },
      d1,
    );
    if (result) results.push(result);
  }

  return results;
}

/**
 * Called from the EFT admin confirm handler on every successful confirmation.
 * Fires only on the referee's FIRST paid subscription EFT; PAYG never rewards.
 * Idempotent, respects monthly + lifetime caps.
 */
export async function maybeRewardReferrerOnPaidEft(
  db: ReturnType<typeof createDb>,
  args: {
    refereeUserId: string;
    isSubscription: boolean;
    triggerReference: string;
    planLookupKey?: string | null;
  },
  d1: D1Database = db.$client,
): Promise<RewardResult | null> {
  const { refereeUserId, isSubscription, triggerReference, planLookupKey } = args;
  const ref = (
    await db.select().from(referrals).where(eq(referrals.refereeUserId, refereeUserId))
  )[0];
  if (!ref || ref.referrerFirstPaidBonusGranted) return null;
  if (!isSubscription) return { granted: false, reason: "not_subscription" };

  const creditsToGrant = rewardForPlan(planLookupKey);
  if (creditsToGrant <= 0) return { granted: false, reason: "plan_not_rewardable" };

  const referrerCompany = (
    await db
      .select()
      .from(companies)
      .where(eq(companies.userId, ref.referrerUserId))
      .orderBy(companies.createdAt)
  )[0];
  if (!referrerCompany) {
    await db
      .update(referrals)
      .set({
        status: "pending_referrer_company",
        pendingReferrerCredits: creditsToGrant,
        pendingPlanLookupKey: planLookupKey ?? null,
        pendingTriggerReference: triggerReference,
      })
      .where(
        and(
          eq(referrals.id, ref.id),
          eq(referrals.referrerFirstPaidBonusGranted, false),
          isNull(referrals.pendingReferrerCredits),
        ),
      );

    // Close the race where the company was created while this reward was being parked.
    const companyAfterPark = (
      await db
        .select()
        .from(companies)
        .where(eq(companies.userId, ref.referrerUserId))
        .orderBy(companies.createdAt)
    )[0];
    if (companyAfterPark) {
      const claimed = await claimPendingReferralRewards(
        db,
        { referrerUserId: ref.referrerUserId, referrerCompanyId: companyAfterPark.id },
        d1,
      );
      return claimed[0] ?? null;
    }
    return { granted: false, reason: "referrer_has_no_company" };
  }

  return grantReferralReward(
    db,
    ref,
    {
      referrerCompanyId: referrerCompany.id,
      creditsToGrant,
      planLookupKey: planLookupKey ?? null,
      triggerReference,
    },
    d1,
  );
}

interface ReferralStats {
  code: string;
  invited_count: number;
  subscribed_count: number;
  credits_earned: number;
  monthly_used: number;
  monthly_cap: number;
  monthly_remaining: number;
  lifetime_used: number;
  lifetime_cap: number;
  lifetime_remaining: number;
  reward_config: {
    referee_signup_bonus: number;
    tier_rewards: Record<string, number>;
  };
  recent: Array<{
    referee_email: string;
    status: string;
    created_at: string;
    first_paid_at: string | null;
  }>;
}

/** Dashboard stats for a user's referral tab. */
export async function myStats(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<ReferralStats> {
  const code = await ensureReferralCode(db, userId);

  const invitedRows = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId))
    .orderBy(sql`${referrals.createdAt} DESC`);
  const subscribed = invitedRows.filter((r) => r.referrerSubBonusGranted).length;

  const creditsEarned =
    (
      await db
        .select({ total: sql<number>`coalesce(sum(${referralRewards.creditsGranted}), 0)` })
        .from(referralRewards)
        .where(eq(referralRewards.referrerUserId, userId))
    )[0]?.total ?? 0;

  const monthlyUsed = await rewardsUsedThisMonth(db, userId);
  const lifetimeUsed = await rewardsUsedLifetime(db, userId);

  // Redact referee emails so referrers can identify their invite but not spam it.
  const recent = invitedRows.slice(0, 10).map((r) => {
    let email = r.refereeEmail || "";
    if (email.includes("@")) {
      const [local, domain] = email.split("@", 2) as [string, string];
      if (local.length > 3) email = `${local.slice(0, 2)}***@${domain}`;
    }
    return {
      referee_email: email,
      status: r.status,
      created_at: new Date(r.createdAt).toISOString(),
      first_paid_at: r.firstPaidAt ? new Date(r.firstPaidAt).toISOString() : null,
    };
  });

  return {
    code,
    invited_count: invitedRows.length,
    subscribed_count: subscribed,
    credits_earned: Number(creditsEarned),
    monthly_used: monthlyUsed,
    monthly_cap: MONTHLY_REWARD_CAP,
    monthly_remaining: Math.max(0, MONTHLY_REWARD_CAP - monthlyUsed),
    lifetime_used: lifetimeUsed,
    lifetime_cap: LIFETIME_REWARD_CAP,
    lifetime_remaining: Math.max(0, LIFETIME_REWARD_CAP - lifetimeUsed),
    reward_config: {
      referee_signup_bonus: REFEREE_SIGNUP_BONUS,
      tier_rewards: TIER_REWARDS,
    },
    recent,
  };
}
