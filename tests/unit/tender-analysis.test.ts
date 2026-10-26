import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import type { Database } from "@/db";
import { user } from "@/db/schema/auth";
import { companies, type CompanyRow } from "@/db/schema/company";
import { companyCredits } from "@/db/schema/credits";
import type { AiResult } from "@/lib/ai";
import { getCredits } from "@/lib/credits";
import { fetchOwnedTender } from "@/lib/ownership";
import type { AuthedSession } from "@/lib/server-auth";
import {
  analyzeTender,
  type AnalyzeBoundary,
  type AnalyzeOutcome,
} from "@/lib/tender-analysis.server";

import { createTestDb } from "../helpers/test-db";

// V04: the paid analysis path must charge exactly one Credit on success and
// restore it on failure. Assertions go through the public analyzeTender /
// getCredits / fetchOwnedTender seams; only the external R2 and AI
// boundaries are preset, like the r2-response fixture.

const PDF_BYTES = new Uint8Array(
  readFileSync(join(import.meta.dirname, "../fixtures/tender-4eb.pdf")),
);

const AI_OK: AiResult = {
  tender_title: "Fixture tender TN-4EB",
  tender_number: "TN-4EB",
  issuing_entity: "City of Tshwane",
  required_cidb: "4EB",
  closing_date: "2026-12-31",
  mandatory_returnables: ["SBD 1 – Invitation to bid"],
  evaluation_criteria: ["Functionality", "Price"],
};

function makeBoundary(overrides: Partial<AnalyzeBoundary> = {}) {
  const objects = new Map<string, Uint8Array>();
  const calls = { put: 0, delete: 0, analyze: 0 };
  const boundary: AnalyzeBoundary = {
    storage: {
      put: async (key, value) => {
        calls.put++;
        objects.set(key, value);
      },
      delete: async (key) => {
        calls.delete++;
        objects.delete(key);
      },
    },
    analyze: async () => {
      calls.analyze++;
      return AI_OK;
    },
    ...overrides,
  };
  return { boundary, objects, calls };
}

async function seedCompany(db: Database, credits = 5): Promise<CompanyRow> {
  const now = new Date();
  await db.insert(user).values({
    id: "owner",
    name: "Owner",
    email: "owner@example.com",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(companies).values({
    id: "co",
    userId: "owner",
    companyName: "Analysis Co",
    cipcNum: "2026/123456/07",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(companyCredits).values({ companyId: "co", credits, updatedAt: now });
  return (await db.select().from(companies).where(eq(companies.id, "co")))[0]!;
}

const SESSION = { user: { id: "owner" } } as AuthedSession;

/** Unwraps the analysis id after the `ok: true` assertion — keeps expects unconditional. */
function tenderIdOf(outcome: AnalyzeOutcome): string {
  return outcome.ok ? outcome.analysis.tender_id : "tender-missing";
}

describe("paid tender analysis", () => {
  it("charges exactly one Credit per successful analysis and stores the tender", async () => {
    const db = createTestDb();
    const company = await seedCompany(db, 5);
    const { boundary, objects, calls } = makeBoundary();

    const first = await analyzeTender(db, boundary, {
      company,
      bytes: PDF_BYTES,
      preferenceSystem: "80/20",
    });
    expect(first).toMatchObject({
      ok: true,
      analysis: {
        tender_title: "Fixture tender TN-4EB",
        required_cidb: "4EB",
        preference_point_system: "80/20",
      },
    });
    expect(await getCredits(db, "co")).toBe(4);
    expect(calls).toEqual({ put: 1, delete: 0, analyze: 1 });
    expect(objects.size).toBe(1);

    // The stored tender is readable through the public ownership seam.
    const owned = await fetchOwnedTender(db, tenderIdOf(first), SESSION);
    expect(owned).toMatchObject({ tender: { title: "Fixture tender TN-4EB" } });

    // A second analysis spends exactly one more — no caching, no double-charge.
    const second = await analyzeTender(db, boundary, {
      company,
      bytes: PDF_BYTES,
      preferenceSystem: "80/20",
    });
    expect(second.ok).toBe(true);
    expect(await getCredits(db, "co")).toBe(3);
  });

  it("restores the Credit and removes the stored PDF when analysis fails", async () => {
    const db = createTestDb();
    const company = await seedCompany(db, 5);
    const { boundary, objects, calls } = makeBoundary({
      analyze: async () => {
        calls.analyze++;
        throw new Error("model timeout");
      },
    });

    const result = await analyzeTender(db, boundary, {
      company,
      bytes: PDF_BYTES,
      preferenceSystem: "80/20",
    });
    expect(result).toEqual({
      ok: false,
      status: 502,
      detail: "AI could not parse this tender document. Your credit has been refunded.",
    });
    expect(await getCredits(db, "co")).toBe(5);
    expect(calls.put).toBe(1);
    expect(calls.delete).toBe(1);
    expect(objects.size).toBe(0);
  });

  it("restores the Credit when the PDF yields no text, before storage is touched", async () => {
    const db = createTestDb();
    const company = await seedCompany(db, 5);
    const { boundary, objects, calls } = makeBoundary();
    const emptyPdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

    const result = await analyzeTender(db, boundary, {
      company,
      bytes: emptyPdf,
      preferenceSystem: "80/20",
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      detail: "Failed to extract PDF text. Your credit has been refunded.",
    });
    expect(await getCredits(db, "co")).toBe(5);
    expect(calls).toEqual({ put: 0, delete: 0, analyze: 0 });
    expect(objects.size).toBe(0);
  });

  it("surfaces a refund failure instead of hiding the lost Credit", async () => {
    const db = createTestDb();
    const company = await seedCompany(db, 5);
    // Consume decrements (no fire); the refund upsert increments (fires).
    await db.$client.batch([
      db.$client
        .prepare(
          `CREATE TRIGGER test_fail_refund BEFORE UPDATE ON company_credits
           WHEN NEW.credits > OLD.credits
           BEGIN SELECT RAISE(ABORT, 'fixture refund failure'); END;`,
        )
        .bind(),
    ]);
    const { boundary } = makeBoundary({
      analyze: async () => {
        throw new Error("model timeout");
      },
    });

    const result = await analyzeTender(db, boundary, {
      company,
      bytes: PDF_BYTES,
      preferenceSystem: "80/20",
    });
    expect(result).toEqual({
      ok: false,
      status: 500,
      detail: "Analysis failed and the automatic credit refund failed. Please contact support.",
    });
    expect(await getCredits(db, "co")).toBe(4);
  });

  it("refuses without spending when the balance is empty", async () => {
    const db = createTestDb();
    const company = await seedCompany(db, 0);
    const { boundary, calls } = makeBoundary();

    const result = await analyzeTender(db, boundary, {
      company,
      bytes: PDF_BYTES,
      preferenceSystem: "80/20",
    });
    expect(result).toEqual({
      ok: false,
      status: 402,
      detail: "Insufficient credits. Please purchase a credit pack or subscribe to a monthly plan.",
    });
    expect(await getCredits(db, "co")).toBe(0);
    expect(calls).toEqual({ put: 0, delete: 0, analyze: 0 });
  });
});
