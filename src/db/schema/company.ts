import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyName: text("companyName").notNull(),
    cipcNum: text("cipcNum").notNull(),
    csdMaaaNum: text("csdMaaaNum"),
    sarsTcsPin: text("sarsTcsPin"),
    cidbCrsNum: text("cidbCrsNum"),
    bbbeeLevel: integer("bbbeeLevel"),
    contactEmail: text("contactEmail"),
    contactPhone: text("contactPhone"),
    authorisedSignatoryName: text("authorisedSignatoryName"),
    authorisedSignatoryPosition: text("authorisedSignatoryPosition"),
    bargainingCouncils: text("bargainingCouncils"),
    preferredPppfaSystem: text("preferredPppfaSystem"),
    alertsEnabled: integer("alertsEnabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("companies_userId_idx").on(t.userId)],
);

export type CompanyRow = typeof companies.$inferSelect;
