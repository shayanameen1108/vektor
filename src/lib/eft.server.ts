/**
 * EFT admin confirmation — the production write path. Lives outside `eft.ts`
 * because that module is imported by browser billing code; this file owns the
 * atomic payment SQL and the referral-reward handoff behind `confirmEft`.
 */

import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db";
import { eftPayments, type EftPaymentRow } from "@/db/schema/eft";
import { rolloverCapForCycleCredits } from "@/lib/eft";
import { TIER_REWARDS, maybeRewardReferrerOnPaidEft } from "@/lib/referral";

export type ConfirmEftResult =
  | { ok: true; payment: EftPaymentRow; newlyConfirmed: boolean; referralPending: boolean }
  | { ok: false; status: 400 | 404 | 409; detail: string };

/**
 * Durable first-paid pin: record the referee's earliest confirmed
 * subscription EFT on the referral row BEFORE any separate reward call, so a
 * reward failure can always be retried against the original plan. Case arms
 * are generated from TIER_REWARDS — no duplicated monetary constants.
 * Deterministic `confirmedAt, createdAt, id` order; equal timestamps from
 * before this patch are a bounded historical-tie limitation, not a claim
 * about true pre-patch ordering.
 */
function firstPaidReferralPin(d1: D1Database, refereeUserId: string) {
  const arms = Object.keys(TIER_REWARDS)
    .map(() => "WHEN ? THEN ?")
    .join(" ");
  const sql = `WITH firstPaid AS (
    SELECT lookupKey, reference, confirmedAt
    FROM eft_payments
    WHERE userId = ? AND status = 'confirmed' AND type = 'subscription'
    ORDER BY confirmedAt, createdAt, id
    LIMIT 1
  )
  UPDATE referrals SET
    pendingReferrerCredits = CASE (SELECT lookupKey FROM firstPaid)
      ${arms}
      ELSE 0
    END,
    pendingPlanLookupKey = (SELECT lookupKey FROM firstPaid),
    pendingTriggerReference = (SELECT reference FROM firstPaid),
    firstPaidAt = coalesce(firstPaidAt, (SELECT confirmedAt FROM firstPaid)),
    firstPaidPlanLookupKey = coalesce(firstPaidPlanLookupKey, (SELECT lookupKey FROM firstPaid))
  WHERE refereeUserId = ?
    AND referrerFirstPaidBonusGranted = 0
    AND pendingReferrerCredits IS NULL
    AND EXISTS (SELECT 1 FROM firstPaid)`;
  return d1.prepare(sql).bind(refereeUserId, ...Object.entries(TIER_REWARDS).flat(), refereeUserId);
}

/**
 * Pins the first-paid reward (unless already pinned), then runs it. True
 * while the reward stayed pending: its run failed, and the pin keeps it
 * retryable.
 */
async function referralRewardPending(
  db: Database,
  payment: EftPaymentRow,
  d1: D1Database,
  alreadyPinned: boolean,
): Promise<boolean> {
  try {
    if (!alreadyPinned) await d1.batch([firstPaidReferralPin(d1, payment.userId)]);
    await maybeRewardReferrerOnPaidEft(
      db,
      {
        refereeUserId: payment.userId,
        isSubscription: payment.type === "subscription",
        triggerReference: payment.reference,
        planLookupKey: payment.lookupKey,
      },
      d1,
    );
    return false;
  } catch (error) {
    console.error("Failed to process referral reward", error);
    return true;
  }
}

/**
 * Confirm a pending EFT payment. The payment batch atomically grants credits
 * and stamps the status; the conditional processingToken is the concurrency
 * guard, so a lost race (or an earlier confirmation) reports the durable row
 * instead of double-granting. `newlyConfirmed` is true only for the batch
 * winner; the referral reward is a separate best-effort step afterwards.
 */
export async function confirmEft(
  db: Database,
  input: { paymentId: string; adminUserId: string },
  d1: D1Database = db.$client,
): Promise<ConfirmEftResult> {
  const payment = (
    await db.select().from(eftPayments).where(eq(eftPayments.id, input.paymentId))
  )[0];
  if (!payment) return { ok: false, status: 404, detail: "Payment not found" };
  if (payment.status === "confirmed") {
    // Retrying an already-confirmed payment still completes a reward that
    // failed on the original run — pending fields pin what is owed first.
    const referralPending = await referralRewardPending(db, payment, d1, false);
    return { ok: true, payment, newlyConfirmed: false, referralPending };
  }
  if (payment.status !== "pending_review") {
    return {
      ok: false,
      status: 400,
      detail: `Payment must be in pending_review, currently ${payment.status}`,
    };
  }

  const token = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const rolloverCap = rolloverCapForCycleCredits(payment.credits);
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE eft_payments
         SET processingToken = ?, updatedAt = ?, creditsGranted = CASE
           WHEN type = 'subscription' THEN max(
             0,
             max(
               coalesce((SELECT credits FROM company_credits WHERE companyId = eft_payments.companyId), 0),
               min(
                 coalesce((SELECT credits FROM company_credits WHERE companyId = eft_payments.companyId), 0) + credits,
                 ?
               )
             ) - coalesce((SELECT credits FROM company_credits WHERE companyId = eft_payments.companyId), 0)
           )
           ELSE credits
         END
         WHERE id = ? AND status = 'pending_review' AND processingToken IS NULL`,
      )
      .bind(token, now, rolloverCap, payment.id),
    d1
      .prepare(
        `INSERT INTO company_credits
          (companyId, credits, subscriptionLookupKey, subscriptionCycleCredits,
           subscriptionRolloverCap, subscriptionStartedAt, subscriptionActive, updatedAt)
         SELECT companyId, creditsGranted,
           CASE WHEN type = 'subscription' THEN lookupKey ELSE NULL END,
           CASE WHEN type = 'subscription' THEN credits ELSE NULL END,
           CASE WHEN type = 'subscription' THEN ? ELSE NULL END,
           CASE WHEN type = 'subscription' THEN ? ELSE NULL END,
           CASE WHEN type = 'subscription' THEN 1 ELSE 0 END, ?
         FROM eft_payments WHERE id = ? AND processingToken = ?
         ON CONFLICT(companyId) DO UPDATE SET
           credits = CASE
             WHEN excluded.subscriptionActive = 1 THEN max(
               company_credits.credits,
               min(company_credits.credits + excluded.credits, excluded.subscriptionRolloverCap)
             )
             ELSE company_credits.credits + excluded.credits
           END,
           subscriptionLookupKey = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionLookupKey ELSE company_credits.subscriptionLookupKey END,
           subscriptionCycleCredits = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionCycleCredits ELSE company_credits.subscriptionCycleCredits END,
           subscriptionRolloverCap = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionRolloverCap ELSE company_credits.subscriptionRolloverCap END,
           subscriptionStartedAt = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionStartedAt ELSE company_credits.subscriptionStartedAt END,
           subscriptionActive = CASE WHEN excluded.subscriptionActive = 1 THEN 1 ELSE company_credits.subscriptionActive END,
           updatedAt = excluded.updatedAt`,
      )
      .bind(rolloverCap, now, now, payment.id, token),
    d1
      .prepare(
        `UPDATE eft_payments
         SET status = 'confirmed', confirmedAt = ?, confirmedBy = ?,
             processingToken = NULL, updatedAt = ?
         WHERE id = ? AND processingToken = ?`,
      )
      .bind(now, input.adminUserId, now, payment.id, token),
    // Atomically pin the first-paid reward inside the same batch: a racing
    // confirm sees the pin (or the earlier confirmed payment) before any
    // separate reward call can pick a later payment.
    firstPaidReferralPin(d1, payment.userId),
  ]);

  const won = Number(results[0]!.meta.changes ?? 0) === 1;
  const durable = (await db.select().from(eftPayments).where(eq(eftPayments.id, payment.id)))[0];
  if (!durable) return { ok: false, status: 404, detail: "Payment not found" };
  if (!won) {
    if (durable.status === "confirmed") {
      const referralPending = await referralRewardPending(db, durable, d1, false);
      return { ok: true, payment: durable, newlyConfirmed: false, referralPending };
    }
    return { ok: false, status: 409, detail: "Payment state changed; refresh and try again" };
  }

  const referralPending = await referralRewardPending(db, durable, d1, true);
  return { ok: true, payment: durable, newlyConfirmed: true, referralPending };
}

export type RejectEftResult =
  | { ok: true; payment: EftPaymentRow }
  | { ok: false; status: 400 | 404 | 409; detail: string };

/**
 * Reject a pending EFT payment. Same single-guard pattern as `confirmEft`:
 * the conditional UPDATE is the state machine, so a concurrent decision
 * reports 409 instead of overwriting a settled payment. Rejection grants
 * no credits, so there is no reward handoff — the caller sends the email.
 */
export async function rejectEft(
  db: Database,
  input: { paymentId: string; adminUserId: string; reason: string },
): Promise<RejectEftResult> {
  const payment = (
    await db.select().from(eftPayments).where(eq(eftPayments.id, input.paymentId))
  )[0];
  if (!payment) return { ok: false, status: 404, detail: "Payment not found" };
  if (payment.status !== "pending_review") {
    return {
      ok: false,
      status: 400,
      detail: `Cannot reject a ${payment.status} payment`,
    };
  }

  const now = new Date();
  const changed = await db
    .update(eftPayments)
    .set({
      status: "rejected",
      rejectReason: input.reason,
      rejectedAt: now,
      rejectedBy: input.adminUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(eftPayments.id, input.paymentId),
        eq(eftPayments.status, "pending_review"),
        isNull(eftPayments.processingToken),
      ),
    )
    .returning({ id: eftPayments.id });
  if (changed.length === 0) {
    return { ok: false, status: 409, detail: "Payment state changed; refresh and try again" };
  }

  const updated = (
    await db.select().from(eftPayments).where(eq(eftPayments.id, input.paymentId))
  )[0]!;
  return { ok: true, payment: updated };
}
