import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { companies } from "@/db/schema/company";
import { complianceDocuments, sentReminders } from "@/db/schema/compliance";
import { user } from "@/db/schema/auth";
import { daysUntil, pickThreshold, sendDocumentReminder } from "@/lib/reminder";

import type { Database } from "@/db";

import { createTestDb } from "../helpers/test-db";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function seed(db: Database): Promise<{ companyId: string; documentId: string }> {
  const now = new Date();
  await db.insert(user).values({
    id: "u-1",
    name: "Owner",
    email: "owner@example.com",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(companies).values({
    id: "co-1",
    userId: "u-1",
    companyName: "Expiry Co",
    cipcNum: "2021/123456/07",
    contactEmail: "compliance@example.com",
    alertsEnabled: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(complianceDocuments).values({
    id: "doc-1",
    companyId: "co-1",
    docType: "TAX_PIN",
    fileName: "tax-pin.pdf",
    expiryDate: new Date(now.getTime() + 7 * 86_400_000),
    isCompliant: true,
    createdAt: now,
    updatedAt: now,
  });
  return { companyId: "co-1", documentId: "doc-1" };
}

/** Mirrors reminder.ts sendDocumentReminder's persistence step. */
async function recordSend(
  db: Database,
  ids: { companyId: string; documentId: string },
  threshold: number,
) {
  await db.insert(sentReminders).values({
    id: crypto.randomUUID(),
    ...ids,
    threshold,
    sentAt: new Date(),
    resendId: "re_test",
    toEmail: "compliance@example.com",
  });
}

describe("reminder thresholds — idempotency against real SQL", () => {
  it("fires exactly once per (company, document, threshold)", async () => {
    const db = createTestDb();
    const ids = await seed(db);

    await recordSend(db, ids, 7);
    // Second sweep attempt for the same threshold must not insert again.
    const existing = await db
      .select()
      .from(sentReminders)
      .where(
        and(
          eq(sentReminders.companyId, ids.companyId),
          eq(sentReminders.documentId, ids.documentId),
          eq(sentReminders.threshold, 7),
        ),
      );
    expect(existing).toHaveLength(1);
    await expect(recordSend(db, ids, 7)).rejects.toThrow();
  });

  it("30 → 7 → 0 each fire on their own schedule", async () => {
    const db = createTestDb();
    const ids = await seed(db);

    await recordSend(db, ids, 30);
    expect(pickThreshold(daysUntil(new Date(Date.now() + 20 * 86_400_000)))).toBe(30);
    expect(pickThreshold(daysUntil(new Date(Date.now() + 5 * 86_400_000)))).toBe(7);
    await recordSend(db, ids, 7);
    expect(pickThreshold(daysUntil(new Date(Date.now() - 86_400_000)))).toBe(0);
    await recordSend(db, ids, 0);

    const all = await db.select().from(sentReminders);
    expect(all.map((r) => r.threshold).sort((a, b) => a - b)).toEqual([0, 7, 30]);
  });

  it("deleting a document clears its idempotency rows (fresh schedule for replacement)", async () => {
    const db = createTestDb();
    const ids = await seed(db);
    await recordSend(db, ids, 7);

    await db.delete(complianceDocuments).where(eq(complianceDocuments.id, ids.documentId));
    expect(await db.select().from(sentReminders)).toHaveLength(0);
  });

  it.each([
    ["network errors", () => Promise.reject(new TypeError("network unavailable"))],
    [
      "responses without a provider id",
      () => Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
    ],
  ])("releases the claim after %s so a later sweep can retry", async (_name, failSend) => {
    const db = createTestDb();
    const ids = await seed(db);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(failSend)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "re_retry" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const send = () =>
      sendDocumentReminder(
        db,
        { RESEND_API_KEY: "test-api-key" },
        {
          id: ids.companyId,
          companyName: "Expiry Co",
          contactEmail: "compliance@example.com",
          alertsEnabled: true,
        },
        {
          id: ids.documentId,
          docType: "TAX_PIN",
          fileName: "tax-pin.pdf",
          expiryDate: "2026-09-02",
          isCompliant: true,
        },
        7,
      );

    await expect(send()).resolves.toMatchObject({ status: "failed", threshold: 7 });
    expect(await db.select().from(sentReminders)).toHaveLength(0);

    await expect(send()).resolves.toMatchObject({
      status: "sent",
      threshold: 7,
      resendId: "re_retry",
    });
    expect(await db.select().from(sentReminders)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
