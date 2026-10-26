import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Database } from "@/db";
import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import { referralRewards, referrals } from "@/db/schema/referral";
import {
  LIFETIME_REWARD_CAP,
  MONTHLY_REWARD_CAP,
  claimPendingReferralRewards,
  isSelfReferral,
  maybeRewardReferrerOnPaidEft,
  rewardForPlan,
} from "@/lib/referral";

import { createTestDb } from "../helpers/test-db";

async function seedReferral(db: Database) {
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
  await db.insert(referrals).values({
    id: "referral",
    referrerUserId: "referrer",
    refereeUserId: "referee",
    refereeEmail: "referee@example.com",
    code: "VEK-ABC123",
    createdAt: now,
  });
}

describe("referral reward rules", () => {
  it("maps only paid subscription tiers to rewards", () => {
    expect(rewardForPlan("tc_starter_monthly_v2")).toBe(3);
    expect(rewardForPlan("tc_pro_monthly_v2")).toBe(5);
    expect(rewardForPlan("tc_scale_monthly_v2")).toBe(10);
    expect(rewardForPlan("tc_credits_1_v2")).toBe(0);
    expect(rewardForPlan("unknown")).toBe(0);
  });

  it("preserves monthly and lifetime reward caps", () => {
    expect(MONTHLY_REWARD_CAP).toBe(5);
    expect(LIFETIME_REWARD_CAP).toBe(20);
  });

  it("blocks matching user ids or case-insensitive email identities", () => {
    expect(
      isSelfReferral(
        { id: "user-1", email: "first@example.com" },
        { id: "user-1", email: "other@example.com" },
      ),
    ).toBe(true);
    expect(
      isSelfReferral(
        { id: "user-1", email: "Alice@Example.com" },
        { id: "user-2", email: "alice@example.COM" },
      ),
    ).toBe(true);
    expect(
      isSelfReferral(
        { id: "user-1", email: "alice@example.com" },
        { id: "user-2", email: "bob@example.com" },
      ),
    ).toBe(false);
  });

  it("preserves and idempotently claims the first paid reward after company creation", async () => {
    const db = createTestDb();
    await seedReferral(db);

    await expect(
      maybeRewardReferrerOnPaidEft(db, {
        refereeUserId: "referee",
        isSubscription: true,
        triggerReference: "VEK-FIRST1",
        planLookupKey: "tc_pro_monthly_v2",
      }),
    ).resolves.toMatchObject({ granted: false, reason: "referrer_has_no_company" });
    await maybeRewardReferrerOnPaidEft(db, {
      refereeUserId: "referee",
      isSubscription: true,
      triggerReference: "VEK-LATER2",
      planLookupKey: "tc_scale_monthly_v2",
    });

    expect((await db.select().from(referrals))[0]).toMatchObject({
      pendingReferrerCredits: 5,
      pendingPlanLookupKey: "tc_pro_monthly_v2",
      pendingTriggerReference: "VEK-FIRST1",
    });

    const now = new Date();
    await db.insert(companies).values({
      id: "company",
      userId: "referrer",
      companyName: "Referrer Co",
      cipcNum: "2026/123456/07",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(companyCredits).values({ companyId: "company", credits: 1, updatedAt: now });

    await expect(
      claimPendingReferralRewards(db, {
        referrerUserId: "referrer",
        referrerCompanyId: "company",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        granted: true,
        credits: 5,
        plan_lookup_key: "tc_pro_monthly_v2",
      }),
    ]);
    await expect(
      claimPendingReferralRewards(db, {
        referrerUserId: "referrer",
        referrerCompanyId: "company",
      }),
    ).resolves.toEqual([]);

    expect(
      (await db.select().from(companyCredits).where(eq(companyCredits.companyId, "company")))[0]
        ?.credits,
    ).toBe(6);
    expect(await db.select().from(referralRewards)).toEqual([
      expect.objectContaining({
        creditsGranted: 5,
        planLookupKey: "tc_pro_monthly_v2",
        triggerReference: "VEK-FIRST1",
      }),
    ]);
    expect((await db.select().from(referrals))[0]).toMatchObject({
      status: "first_paid_subscription",
      referrerFirstPaidBonusGranted: true,
      firstPaidPlanLookupKey: "tc_pro_monthly_v2",
      pendingReferrerCredits: null,
      pendingPlanLookupKey: null,
      pendingTriggerReference: null,
    });
  });
});
