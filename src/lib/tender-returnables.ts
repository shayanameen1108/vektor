import { and, eq, isNull } from "drizzle-orm";

import type { createDb } from "@/db";
import { tenders, type TenderRow } from "@/db/schema/tender";

export interface ReturnableEntry {
  verified: boolean;
  verified_at: string | null;
  doc_ref: string | null;
  file_name?: string | null;
}
export type ReturnableStatus = Record<string, ReturnableEntry>;

export async function updateReturnables(
  db: ReturnType<typeof createDb>,
  tenderId: string,
  mutate: (current: ReturnableStatus) => ReturnableStatus,
  maxAttempts = 4,
): Promise<{ tender: TenderRow; status: ReturnableStatus } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = (await db.select().from(tenders).where(eq(tenders.id, tenderId)))[0];
    if (!row) return null;
    const oldRaw = row.returnableStatus;
    const current = parseStatus(oldRaw);
    const next = mutate(structuredClone(current));
    const serialized = JSON.stringify(next);
    const changed = await db
      .update(tenders)
      .set({ returnableStatus: serialized, updatedAt: new Date() })
      .where(
        and(
          eq(tenders.id, tenderId),
          oldRaw === null ? isNull(tenders.returnableStatus) : eq(tenders.returnableStatus, oldRaw),
        ),
      )
      .returning();
    if (changed[0]) return { tender: changed[0], status: next };
  }
  throw new Error("Tender returnables changed too frequently; retry the request");
}

function parseStatus(raw: string | null): ReturnableStatus {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ReturnableStatus)
      : {};
  } catch {
    return {};
  }
}

/** All R2 document keys referenced by a persisted returnable status JSON. */
export function returnableDocKeys(raw: string | null): string[] {
  return Object.values(parseStatus(raw)).flatMap((entry) =>
    typeof entry?.doc_ref === "string" ? [entry.doc_ref] : [],
  );
}
