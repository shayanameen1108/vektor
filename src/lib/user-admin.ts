import { eq, inArray } from "drizzle-orm";

import type { Database } from "@/db";
import { user } from "@/db/schema/auth";
import { complianceDocuments } from "@/db/schema/compliance";
import { companies } from "@/db/schema/company";
import { eftPayments } from "@/db/schema/eft";
import { tenders } from "@/db/schema/tender";
import { deleteQuietly } from "@/lib/r2-response";
import { returnableDocKeys } from "@/lib/tender-returnables";

export type DeleteUserOutcome =
  | { ok: true; email: string }
  | { ok: false; status: number; detail: string };

/**
 * Admin user deletion: refuse the protected cases, collect the user's R2
 * object keys before the FK cascade removes their rows, delete, then clean
 * the objects. The route only validates the caller and passes the request.
 */
export async function deleteUserCascade(
  db: Database,
  bucket: { delete(key: string): Promise<unknown> },
  input: {
    adminUserId: string;
    targetUserId: string;
    reason: string;
    confirmEmail: string;
  },
): Promise<DeleteUserOutcome> {
  if (input.targetUserId === input.adminUserId) {
    return { ok: false, status: 400, detail: "You cannot delete yourself" };
  }
  if (!input.reason) {
    return { ok: false, status: 400, detail: "A reason is required for deletion" };
  }

  const target = (await db.select().from(user).where(eq(user.id, input.targetUserId)))[0];
  if (!target) return { ok: false, status: 404, detail: "User not found" };
  if (target.role === "admin") {
    return { ok: false, status: 400, detail: "Cannot delete an admin account" };
  }
  if (!input.confirmEmail || input.confirmEmail !== target.email.toLowerCase()) {
    return {
      ok: false,
      status: 400,
      detail: "Confirmation email doesn't match target user's email",
    };
  }

  // Collect R2 keys before the cascade removes the rows.
  const ownedCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.userId, input.targetUserId));
  const companyIds = ownedCompanies.map((c) => c.id);

  const keys: string[] = [];
  if (companyIds.length > 0) {
    const docs = await db
      .select({ storageKey: complianceDocuments.storageKey })
      .from(complianceDocuments)
      .where(inArray(complianceDocuments.companyId, companyIds));
    const tenderKeys = await db
      .select({ pdfStorageKey: tenders.pdfStorageKey, returnableStatus: tenders.returnableStatus })
      .from(tenders)
      .where(inArray(tenders.companyId, companyIds));
    for (const k of docs) if (k.storageKey) keys.push(k.storageKey);
    for (const tender of tenderKeys) {
      if (tender.pdfStorageKey) keys.push(tender.pdfStorageKey);
      keys.push(...returnableDocKeys(tender.returnableStatus));
    }
  }
  const proofs = await db
    .select({ proofPath: eftPayments.proofPath })
    .from(eftPayments)
    .where(eq(eftPayments.userId, input.targetUserId));
  for (const k of proofs) if (k.proofPath) keys.push(k.proofPath);

  // All child rows (sessions, accounts, companies → documents/tenders/
  // credits/reminders, EFT payments, referrals, rewards) carry
  // ON DELETE CASCADE foreign keys back to user.
  await db.delete(user).where(eq(user.id, input.targetUserId));
  await Promise.all(keys.map((key) => deleteQuietly(bucket, key, "user cascade object")));

  return { ok: true, email: target.email };
}
