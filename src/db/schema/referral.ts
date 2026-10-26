import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { companies } from "./company";

export const referrals = sqliteTable(
  "referrals",
  {
    id: text("id").primaryKey(),
    referrerUserId: text("referrerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refereeUserId: text("refereeUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refereeEmail: text("refereeEmail").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull().default("signed_up"),
    signupBonusGranted: integer("signupBonusGranted", { mode: "boolean" }).notNull().default(false),
    referrerFirstPaidBonusGranted: integer("referrerFirstPaidBonusGranted", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    referrerSubBonusGranted: integer("referrerSubBonusGranted", { mode: "boolean" })
      .notNull()
      .default(false),
    cappedAt: integer("cappedAt", { mode: "timestamp" }),
    capReason: text("capReason"),
    pendingReferrerCredits: integer("pendingReferrerCredits"),
    pendingPlanLookupKey: text("pendingPlanLookupKey"),
    pendingTriggerReference: text("pendingTriggerReference"),
    firstPaidAt: integer("firstPaidAt", { mode: "timestamp" }),
    firstPaidPlanLookupKey: text("firstPaidPlanLookupKey"),
    rewardClaimToken: text("rewardClaimToken"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("referrals_referrer_idx").on(t.referrerUserId),
    uniqueIndex("referrals_referee_unique").on(t.refereeUserId),
    index("referrals_code_idx").on(t.code),
  ],
);

export type ReferralRow = typeof referrals.$inferSelect;

export const referralRewards = sqliteTable(
  "referral_rewards",
  {
    id: text("id").primaryKey(),
    referrerUserId: text("referrerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refereeUserId: text("refereeUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referrerCompanyId: text("referrerCompanyId").references(() => companies.id, {
      onDelete: "set null",
    }),
    creditsGranted: integer("creditsGranted").notNull(),
    type: text("type").notNull().default("first_paid_subscription"),
    planLookupKey: text("planLookupKey"),
    triggerReference: text("triggerReference"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("referral_rewards_referrer_idx").on(t.referrerUserId),
    index("referral_rewards_created_at_idx").on(t.createdAt),
    uniqueIndex("referral_rewards_first_paid_referee_unique").on(t.refereeUserId),
  ],
);
