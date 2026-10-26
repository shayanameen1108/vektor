import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { companies } from "./company";

export const complianceDocuments = sqliteTable(
  "compliance_documents",
  {
    id: text("id").primaryKey(),
    companyId: text("companyId")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    docType: text("docType", {
      enum: ["TAX_PIN", "COIDA", "BBBEE", "BARGAINING_COUNCIL_GOS", "DIRECTOR_ID"],
    }).notNull(),
    fileName: text("fileName").notNull(),
    storageKey: text("storageKey"),
    expiryDate: integer("expiryDate", { mode: "timestamp" }),
    isCompliant: integer("isCompliant", { mode: "boolean" }).notNull().default(true),
    bargainingCouncil: text("bargainingCouncil"),
    scopeKey: text("scopeKey").notNull().default(""),
    extractedBbbeeLevel: integer("extractedBbbeeLevel"),
    extractedExpiryDate: integer("extractedExpiryDate", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("compliance_company_idx").on(t.companyId),
    index("compliance_docType_idx").on(t.docType),
    index("compliance_expiry_idx").on(t.expiryDate),
    uniqueIndex("compliance_company_type_scope_unique").on(t.companyId, t.docType, t.scopeKey),
  ],
);

export const sentReminders = sqliteTable(
  "sent_reminders",
  {
    id: text("id").primaryKey(),
    companyId: text("companyId")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentId: text("documentId")
      .notNull()
      .references(() => complianceDocuments.id, { onDelete: "cascade" }),
    threshold: integer("threshold").notNull(),
    sentAt: integer("sentAt", { mode: "timestamp" }).notNull(),
    resendId: text("resendId"),
    toEmail: text("toEmail"),
  },
  (t) => [
    index("sent_reminders_company_idx").on(t.companyId),
    index("sent_reminders_document_idx").on(t.documentId),
    uniqueIndex("sent_reminders_unique").on(t.companyId, t.documentId, t.threshold),
  ],
);

export type ComplianceDocumentRow = typeof complianceDocuments.$inferSelect;
