import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import type { Database } from "@/db";
import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import { eftPayments, type EftPaymentInsert } from "@/db/schema/eft";
import { referrals } from "@/db/schema/referral";
import { entryByLookup } from "@/lib/billing-catalog";
import { getCredits, setCredits } from "@/lib/credits";
import { confirmEft, rejectEft } from "@/lib/eft.server";
import { claimPendingReferralRewards, maybeRewardReferrerOnPaidEft, myStats } from "@/lib/referral";

import { createTestDb } from "../helpers/test-db";

// V01: admin EFT confirmation must make the referral reward durable and
// retryable. Assertions go through the public confirmEft/getCredits/myStats
// seams — never tables or private helpers.

const ADMIN = "admin-1";

async function seedUsers(db: Database) {
  const now = new Date();
  await db.insert(user).values([
    {
      id: "referrer",
      name: "Referrer",
      email: "referrer@example.com",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "referee",
      name: "Referee",
      email: "referee@example.com",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(companies).values({
    id: "referee-company",
    userId: "referee",
    companyName: "Referee Co",
    cipcNum: "2026/123456/07",
    createdAt: now,
    updatedAt: now,
  });
  await db
    .insert(companyCredits)
    .values({ companyId: "referee-company", credits: 5, updatedAt: now });
  await db.insert(referrals).values({
    id: "referral",
    referrerUserId: "referrer",
    refereeUserId: "referee",
    refereeEmail: "referee@example.com",
    code: "VEK-ABC123",
    createdAt: now,
  });
}

async function seedReferrerCompany(db: Database) {
  const now = new Date();
  await db.insert(companies).values({
    id: "referrer-company",
    userId: "referrer",
    companyName: "Referrer Co",
    cipcNum: "2026/654321/07",
    createdAt: now,
    updatedAt: now,
  });
  await db
    .insert(companyCredits)
    .values({ companyId: "referrer-company", credits: 5, updatedAt: now });
}

async function seedPayment(
  db: Database,
  fields: Pick<EftPaymentInsert, "id" | "reference" | "lookupKey" | "credits"> &
    Partial<EftPaymentInsert>,
) {
  const now = new Date();
  await db.insert(eftPayments).values({
    userId: "referee",
    userEmail: "referee@example.com",
    companyId: "referee-company",
    companyName: "Referee Co",
    packageName: "Pro",
    amount: entryByLookup(fields.lookupKey)!.amount_cents,
    billingPeriod: "monthly",
    type: "subscription",
    status: "pending_review",
    createdAt: now,
    updatedAt: now,
    ...fields,
  });
}

// A real SQLite constraint failure INSIDE the reward batch — the credit
// upsert runs, the reward-ledger insert aborts, and the whole batch rolls
// back. Test-only DDL on the freshly created in-memory fixture.
async function failNextRewardGrant(db: Database) {
  await db.$client.batch([
    db.$client
      .prepare(
        `CREATE TRIGGER test_fail_referral_reward BEFORE INSERT ON referral_rewards
         BEGIN SELECT RAISE(ABORT, 'fixture referral persistence failure'); END;`,
      )
      .bind(),
  ]);
}

async function restoreRewardGrant(db: Database) {
  await db.$client.batch([db.$client.prepare("DROP TRIGGER test_fail_referral_reward;").bind()]);
}

const confirmInput = (paymentId: string) => ({ paymentId, adminUserId: ADMIN });

describe("EFT admin confirmation", () => {
  it("keeps the payment durable on a reward failure and completes it on retry", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });

    await failNextRewardGrant(db);
    const first = await confirmEft(db, confirmInput("payment-pro"));
    expect(first).toMatchObject({
      ok: true,
      newlyConfirmed: true,
      referralPending: true,
      payment: { status: "confirmed" },
    });
    expect(await getCredits(db, "referee-company")).toBe(25);
    expect(await getCredits(db, "referrer-company")).toBe(5);

    await restoreRewardGrant(db);
    const retry = await confirmEft(db, confirmInput("payment-pro"));
    expect(retry).toMatchObject({ ok: true, newlyConfirmed: false, referralPending: false });
    expect(await getCredits(db, "referee-company")).toBe(25);
    expect(await getCredits(db, "referrer-company")).toBe(10);
    const stats = await myStats(db, "referrer");
    expect(stats.credits_earned).toBe(5);
    expect(stats.subscribed_count).toBe(1);

    const again = await confirmEft(db, confirmInput("payment-pro"));
    expect(again).toMatchObject({ ok: true, newlyConfirmed: false, referralPending: false });
    expect(await getCredits(db, "referee-company")).toBe(25);
    expect(await getCredits(db, "referrer-company")).toBe(10);
  });

  it("a later confirmed payment cannot overwrite the pinned first-paid reward", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });
    await seedPayment(db, {
      id: "payment-scale",
      reference: "VEK-SCALE1",
      lookupKey: "tc_scale_monthly_v2",
      credits: 50,
    });

    await failNextRewardGrant(db);
    await confirmEft(db, confirmInput("payment-pro"));
    await restoreRewardGrant(db);

    const scale = await confirmEft(db, confirmInput("payment-scale"));
    expect(scale).toMatchObject({ ok: true, newlyConfirmed: true, referralPending: false });
    // Pro's 5-credit reward wins — not Scale's 10.
    expect(await getCredits(db, "referee-company")).toBe(75);
    expect(await getCredits(db, "referrer-company")).toBe(10);

    const retry = await confirmEft(db, confirmInput("payment-pro"));
    expect(retry).toMatchObject({ ok: true, newlyConfirmed: false, referralPending: false });
    expect(await getCredits(db, "referee-company")).toBe(75);
    expect(await getCredits(db, "referrer-company")).toBe(10);
  });

  it("grants credits and the reward exactly once under concurrent confirms", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });

    const results = await Promise.all([
      confirmEft(db, confirmInput("payment-pro")),
      confirmEft(db, confirmInput("payment-pro")),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.newlyConfirmed)).toHaveLength(1);
    expect(await getCredits(db, "referee-company")).toBe(25);
    expect(await getCredits(db, "referrer-company")).toBe(10);
    expect((await myStats(db, "referrer")).credits_earned).toBe(5);
  });

  it("parks the reward when the referrer has no company, claimable once", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });

    const first = await confirmEft(db, confirmInput("payment-pro"));
    expect(first).toMatchObject({ ok: true, newlyConfirmed: true, referralPending: false });
    expect(await getCredits(db, "referee-company")).toBe(25);

    await seedReferrerCompany(db);
    const claimed = await claimPendingReferralRewards(db, {
      referrerUserId: "referrer",
      referrerCompanyId: "referrer-company",
    });
    expect(claimed).toEqual([
      expect.objectContaining({ granted: true, credits: 5, plan_lookup_key: "tc_pro_monthly_v2" }),
    ]);
    expect(await getCredits(db, "referrer-company")).toBe(10);
    expect(
      await claimPendingReferralRewards(db, {
        referrerUserId: "referrer",
        referrerCompanyId: "referrer-company",
      }),
    ).toEqual([]);
    expect(await getCredits(db, "referrer-company")).toBe(10);
  });

  it("grants PAYG credits without any referral reward", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-payg",
      reference: "VEK-PAYG01",
      lookupKey: "tc_credits_1_v2",
      credits: 1,
      billingPeriod: "one_time",
      type: "one_time",
      packageName: "Credit",
    });

    const result = await confirmEft(db, confirmInput("payment-payg"));
    expect(result).toMatchObject({ ok: true, newlyConfirmed: true, referralPending: false });
    expect(await getCredits(db, "referee-company")).toBe(6);
    expect(await getCredits(db, "referrer-company")).toBe(5);
    expect((await myStats(db, "referrer")).credits_earned).toBe(0);
  });

  it("prefers the pinned original plan when a retry passes later args", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });

    await failNextRewardGrant(db);
    await confirmEft(db, confirmInput("payment-pro")); // durable pin survives
    await restoreRewardGrant(db);

    // Public reward seam called directly with a LATER payment's args — the
    // durable pin, not these args, must shape the completed reward.
    const reward = await maybeRewardReferrerOnPaidEft(db, {
      refereeUserId: "referee",
      isSubscription: false,
      triggerReference: "VEK-PAYG99",
      planLookupKey: "tc_credits_1_v2",
    });
    expect(reward).toEqual({
      granted: true,
      credits: 5,
      referrer_user_id: "referrer",
      plan_lookup_key: "tc_pro_monthly_v2",
      type: "first_paid_subscription",
    });
    expect(await getCredits(db, "referee-company")).toBe(25);
    expect(await getCredits(db, "referrer-company")).toBe(10);
  });

  it("recovers a pre-patch confirmed payment's pinned reward on retry", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    // Pre-patch state: both payments already confirmed, no pin was ever
    // written, and the balances were settled without any reward.
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
      status: "confirmed",
      confirmedAt: new Date("2026-01-10T00:00:00Z"),
    });
    await seedPayment(db, {
      id: "payment-scale",
      reference: "VEK-SCALE1",
      lookupKey: "tc_scale_monthly_v2",
      credits: 50,
      status: "confirmed",
      confirmedAt: new Date("2026-02-10T00:00:00Z"),
    });
    await setCredits(db, "referee-company", 75);

    const scale = await confirmEft(db, confirmInput("payment-scale"));
    expect(scale).toMatchObject({ ok: true, newlyConfirmed: false, referralPending: false });
    // Earliest confirmed subscription wins: Pro's 5 reward, not Scale's 10.
    expect(await getCredits(db, "referee-company")).toBe(75);
    expect(await getCredits(db, "referrer-company")).toBe(10);

    const pro = await confirmEft(db, confirmInput("payment-pro"));
    expect(pro).toMatchObject({ ok: true, newlyConfirmed: false, referralPending: false });
    expect(await getCredits(db, "referee-company")).toBe(75);
    expect(await getCredits(db, "referrer-company")).toBe(10);
  });

  it("refuses states that cannot confirm and changes no balances", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-rejected",
      reference: "VEK-REJ001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
      status: "rejected",
    });

    expect(await confirmEft(db, confirmInput("payment-rejected"))).toEqual({
      ok: false,
      status: 400,
      detail: "Payment must be in pending_review, currently rejected",
    });
    expect(await confirmEft(db, confirmInput("payment-missing"))).toEqual({
      ok: false,
      status: 404,
      detail: "Payment not found",
    });
    expect(await getCredits(db, "referee-company")).toBe(5);
    expect(await getCredits(db, "referrer-company")).toBe(5);
  });
});

// V03: subscription renewal rollovers drive the production conditional SQL
// through confirmEft — the local `balanceAfterRenewal` formula these cases
// replace duplicated the rule and could drift from it silently.
describe("subscription renewal rollover", () => {
  it.each([
    ["fresh subscriber, nothing banked", 0, "tc_pro_monthly_v2", 20, 20],
    ["below the cap", 15, "tc_pro_monthly_v2", 20, 35],
    ["one full cycle banked, at the cap", 20, "tc_pro_monthly_v2", 20, 40],
    ["above one cycle but under the cap", 25, "tc_pro_monthly_v2", 20, 40],
    ["already at the cap", 40, "tc_pro_monthly_v2", 20, 40],
    ["one below the cap banks to the cap", 39, "tc_pro_monthly_v2", 20, 40],
    ["over the cap after a downgrade", 55, "tc_starter_monthly_v2", 5, 55],
  ] as const)(
    "%s keeps the expected balance after renewal",
    async (_name, held, lookupKey, cycleCredits, expected) => {
      const db = createTestDb();
      await seedUsers(db);
      await seedReferrerCompany(db);
      await setCredits(db, "referee-company", held);
      await seedPayment(db, {
        id: `payment-${held}-${cycleCredits}`,
        reference: `VEK-R${String(held)}${String(cycleCredits)}`,
        lookupKey,
        credits: cycleCredits,
      });

      const result = await confirmEft(db, confirmInput(`payment-${held}-${cycleCredits}`));
      expect(result).toMatchObject({ ok: true, newlyConfirmed: true });
      expect(await getCredits(db, "referee-company")).toBe(expected);
    },
  );

  it("grants the cycle when the company has no credit row yet", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await db.delete(companyCredits).where(eq(companyCredits.companyId, "referee-company"));
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });

    const result = await confirmEft(db, confirmInput("payment-pro"));
    expect(result).toMatchObject({ ok: true, newlyConfirmed: true });
    expect(await getCredits(db, "referee-company")).toBe(20);
  });
});

// V03: the rejection side of the state machine — no credits, no reward, and
// a decided payment stays decided. Exercised through the same public seam
// the route calls.
describe("EFT admin rejection", () => {
  it("rejects a pending payment without granting credits or a reward", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-pro",
      reference: "VEK-PRO001",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
    });

    const result = await rejectEft(db, {
      paymentId: "payment-pro",
      adminUserId: ADMIN,
      reason: "Proof of payment is illegible",
    });
    expect(result).toMatchObject({
      ok: true,
      payment: { status: "rejected", rejectReason: "Proof of payment is illegible" },
    });
    expect(await getCredits(db, "referee-company")).toBe(5);
    expect(await getCredits(db, "referrer-company")).toBe(5);
    expect((await myStats(db, "referrer")).credits_earned).toBe(0);

    // A rejected payment stays decided: it cannot be confirmed afterwards.
    expect(await confirmEft(db, confirmInput("payment-pro"))).toEqual({
      ok: false,
      status: 400,
      detail: "Payment must be in pending_review, currently rejected",
    });
    expect(await getCredits(db, "referee-company")).toBe(5);
  });

  it.each(["confirmed", "rejected", "awaiting_proof"] as const)(
    "refuses to reject a %s payment and changes no balances",
    async (status) => {
      const db = createTestDb();
      await seedUsers(db);
      await seedReferrerCompany(db);
      await seedPayment(db, {
        id: `payment-${status}`,
        reference: `VEK-${status.slice(0, 6).toUpperCase()}`,
        lookupKey: "tc_pro_monthly_v2",
        credits: 20,
        status,
      });

      expect(
        await rejectEft(db, {
          paymentId: `payment-${status}`,
          adminUserId: ADMIN,
          reason: "x",
        }),
      ).toEqual({
        ok: false,
        status: 400,
        detail: `Cannot reject a ${status} payment`,
      });
      expect(await getCredits(db, "referee-company")).toBe(5);
    },
  );

  it("reports a held or missing payment instead of overwriting it", async () => {
    const db = createTestDb();
    await seedUsers(db);
    await seedReferrerCompany(db);
    await seedPayment(db, {
      id: "payment-held",
      reference: "VEK-HELD01",
      lookupKey: "tc_pro_monthly_v2",
      credits: 20,
      processingToken: "concurrent-confirm",
    });

    expect(
      await rejectEft(db, {
        paymentId: "payment-held",
        adminUserId: ADMIN,
        reason: "x",
      }),
    ).toEqual({ ok: false, status: 409, detail: "Payment state changed; refresh and try again" });
    expect(
      await rejectEft(db, { paymentId: "payment-missing", adminUserId: ADMIN, reason: "x" }),
    ).toEqual({ ok: false, status: 404, detail: "Payment not found" });
    expect(await getCredits(db, "referee-company")).toBe(5);
  });
});
