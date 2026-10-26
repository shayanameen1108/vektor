import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { companies } from "./company";

export const companyCredits = sqliteTable("company_credits", {
  companyId: text("companyId")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  credits: integer("credits").notNull().default(0),
  // Subscription state — written when an admin confirms a subscription EFT.
  // Null when the company has never held a subscription (PAYG-only).
  subscriptionLookupKey: text("subscriptionLookupKey"),
  subscriptionCycleCredits: integer("subscriptionCycleCredits"),
  subscriptionRolloverCap: integer("subscriptionRolloverCap"),
  subscriptionStartedAt: integer("subscriptionStartedAt", { mode: "timestamp" }),
  subscriptionActive: integer("subscriptionActive", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});
