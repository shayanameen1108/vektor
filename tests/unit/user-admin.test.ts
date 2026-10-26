import { describe, expect, it } from "vite-plus/test";

import type { Database } from "@/db";
import { user } from "@/db/schema/auth";
import { complianceDocuments } from "@/db/schema/compliance";
import { companies } from "@/db/schema/company";
import { eftPayments } from "@/db/schema/eft";
import { tenders } from "@/db/schema/tender";
import { deleteUserCascade } from "@/lib/user-admin";

import { createTestDb } from "../helpers/test-db";

function bucket() {
  const deleted: string[] = [];
  return {
    deleted,
    async delete(key: string) {
      deleted.push(key);
    },
  };
}

async function seedTarget(
  db: Database,
  overrides: Partial<typeof user.$inferInsert> = {},
): Promise<void> {
  const now = new Date();
  await db.insert(user).values({
    id: "target",
    name: "Target",
    email: "target@example.com",
    role: "user",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  await db.insert(companies).values({
    id: "co",
    userId: overrides.id ?? "target",
    companyName: "Target Co",
    cipcNum: "2026/123456/07",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(complianceDocuments).values({
    id: "doc",
    companyId: "co",
    docType: "TAX_PIN",
    fileName: "tax.pdf",
    storageKey: "doc-key",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(tenders).values({
    id: "tender",
    companyId: "co",
    title: "Tender",
    fitScore: 0,
    pdfStorageKey: "tender-pdf-key",
    returnableStatus: JSON.stringify({ a: { doc_ref: "returnable-key" }, b: { other: 1 } }),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(eftPayments).values({
    id: "eft",
    reference: "EFT-TARGET",
    userId: overrides.id ?? "target",
    userEmail: "target@example.com",
    companyId: "co",
    lookupKey: "lookup",
    packageName: "pack",
    amount: 10000,
    credits: 1,
    billingPeriod: "one_time",
    type: "one_time",
    status: "confirmed",
    proofPath: "proof-key",
    createdAt: now,
    updatedAt: now,
  });
}

const input = { adminUserId: "admin", targetUserId: "target", reason: "requested" };

describe("deleteUserCascade", () => {
  it("deletes the user, cascades child rows, and cleans every stored object", async () => {
    const db = createTestDb();
    await seedTarget(db);
    const r2 = bucket();

    const outcome = await deleteUserCascade(db, r2, {
      ...input,
      confirmEmail: "target@example.com",
    });

    expect(outcome).toEqual({ ok: true, email: "target@example.com" });
    expect(r2.deleted.sort()).toEqual(
      ["doc-key", "proof-key", "returnable-key", "tender-pdf-key"].sort(),
    );

    // Observable through the public function: the target is gone.
    const again = await deleteUserCascade(db, r2, { ...input, confirmEmail: "target@example.com" });
    expect(again).toEqual({ ok: false, status: 404, detail: "User not found" });
  });

  it("refuses when the admin targets themselves", async () => {
    const db = createTestDb();
    await seedTarget(db, { id: "admin" });
    const r2 = bucket();

    const outcome = await deleteUserCascade(db, r2, {
      ...input,
      targetUserId: "admin",
      confirmEmail: "target@example.com",
    });

    expect(outcome).toEqual({ ok: false, status: 400, detail: "You cannot delete yourself" });
    expect(r2.deleted).toEqual([]);
  });

  it("refuses without a reason", async () => {
    const db = createTestDb();
    const r2 = bucket();

    const outcome = await deleteUserCascade(db, r2, { ...input, reason: "", confirmEmail: "x" });

    expect(outcome).toEqual({
      ok: false,
      status: 400,
      detail: "A reason is required for deletion",
    });
    expect(r2.deleted).toEqual([]);
  });

  it("refuses an admin target", async () => {
    const db = createTestDb();
    await seedTarget(db, { role: "admin" });
    const r2 = bucket();

    const outcome = await deleteUserCascade(db, r2, {
      ...input,
      confirmEmail: "target@example.com",
    });

    expect(outcome).toEqual({ ok: false, status: 400, detail: "Cannot delete an admin account" });
    expect(r2.deleted).toEqual([]);
  });

  it("refuses a mismatched confirmation email", async () => {
    const db = createTestDb();
    await seedTarget(db);
    const r2 = bucket();

    const outcome = await deleteUserCascade(db, r2, {
      ...input,
      confirmEmail: "wrong@example.com",
    });

    expect(outcome).toEqual({
      ok: false,
      status: 400,
      detail: "Confirmation email doesn't match target user's email",
    });
    expect(r2.deleted).toEqual([]);
  });
});
