import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { companies } from "@/db/schema/company";
import { complianceDocuments } from "@/db/schema/compliance";
import { user } from "@/db/schema/auth";
import { sendDocumentReminder } from "@/lib/reminder";

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

function stubResend(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  vi.stubGlobal("fetch", fetchMock);
}

function sendOnce(db: Database, ids: { companyId: string; documentId: string }) {
  return sendDocumentReminder(
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
}

function resendOk(id = "re_retry") {
  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("reminder threshold idempotency through the public send", () => {
  it("does not resend a threshold the sweep already recorded", async () => {
    const db = createTestDb();
    const ids = await seed(db);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(resendOk("re_first"));
    stubResend(fetchMock);

    await expect(sendOnce(db, ids)).resolves.toMatchObject({
      status: "sent",
      threshold: 7,
      resendId: "re_first",
    });
    await expect(sendOnce(db, ids)).resolves.toMatchObject({
      status: "skipped",
      reason: "already sent",
      threshold: 7,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
      .mockResolvedValueOnce(resendOk());
    stubResend(fetchMock);

    await expect(sendOnce(db, ids)).resolves.toMatchObject({ status: "failed", threshold: 7 });

    // The claim was released, so the retry really sends — observable in the
    // returned outcome and in a single new provider call.
    await expect(sendOnce(db, ids)).resolves.toMatchObject({
      status: "sent",
      threshold: 7,
      resendId: "re_retry",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(sendOnce(db, ids)).resolves.toMatchObject({
      status: "skipped",
      reason: "already sent",
      threshold: 7,
    });
  });
});
