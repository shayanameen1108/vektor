import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { companies } from "./company";

export const tenders = sqliteTable(
  "tenders",
  {
    id: text("id").primaryKey(),
    companyId: text("companyId")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    tenderNumber: text("tenderNumber"),
    title: text("title").notNull(),
    issuingEntity: text("issuingEntity"),
    closingDate: text("closingDate"),
    requiredCidbGrade: text("requiredCidbGrade"),
    preferencePointSystem: text("preferencePointSystem").notNull().default("80/20"),
    parsedReturnables: text("parsedReturnables"),
    evaluationCriteria: text("evaluationCriteria"),
    fitScore: integer("fitScore").notNull(),
    riskFlags: text("riskFlags"),
    eligibleBbbeePoints: real("eligibleBbbeePoints").notNull().default(0),
    returnableStatus: text("returnableStatus"),
    pdfStorageKey: text("pdfStorageKey"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("tenders_companyId_idx").on(t.companyId),
    index("tenders_createdAt_idx").on(t.createdAt),
  ],
);

export type TenderRow = typeof tenders.$inferSelect;
