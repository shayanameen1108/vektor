import { describe, expect, it } from "vitest";

import { user } from "@/db/schema/auth";
import { companies } from "@/db/schema/company";
import { consumeCredit, getCredits, refundCredit, setCredits } from "@/lib/credits";

import type { Database } from "@/db";

import { createTestDb } from "../helpers/test-db";

async function seedCompany(db: Database): Promise<void> {
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
    companyName: "Test Co",
    cipcNum: "2021/123456/07",
    createdAt: now,
    updatedAt: now,
  });
}

describe("credit consume/refund", () => {
  it("atomically consumes only an available credit", async () => {
    const db = createTestDb();
    await seedCompany(db);
    await setCredits(db, "co-1", 1);
    expect(await consumeCredit(db, "co-1")).toBe(true);
    expect(await consumeCredit(db, "co-1")).toBe(false);
    expect(await getCredits(db, "co-1")).toBe(0);
  });

  it("refunds a consumed credit", async () => {
    const db = createTestDb();
    await seedCompany(db);
    await setCredits(db, "co-1", 2);
    expect(await consumeCredit(db, "co-1")).toBe(true);
    await refundCredit(db, "co-1");
    expect(await getCredits(db, "co-1")).toBe(2);
  });
});
