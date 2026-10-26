import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/sqlite-proxy";

import { type Database } from "@/db";
import * as schema from "@/db/schema";

/**
 * Real-SQLite test database for the domain rules the spec names
 * (credit consume/refund, sent_reminders idempotency). Uses Node's built-in
 * `node:sqlite` through drizzle's sqlite-proxy — same SQL semantics (unique
 * indexes, atomic UPDATE guards, FK cascade) as D1 in production. The schema
 * is applied straight from the generated Drizzle migrations in `drizzle/`,
 * so tests can never drift from the production DDL.
 */
export function createTestDb(): Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      // Same positional mapping drizzle's own D1 driver applies to name-keyed
      // result objects — keeps test/production row-shaping identical.
      const rows = stmt.all(...params).map((row) => Object.values(row));
      if (method === "get") return { rows: rows.slice(0, 1) };
      return { rows };
    },
    { schema },
  ) as unknown as Database;

  type BatchStatement = { sql: string; params: unknown[] };
  const d1 = {
    prepare(sql: string) {
      const statement: BatchStatement = { sql, params: [] };
      return {
        bind(...params: unknown[]) {
          return { ...statement, params };
        },
      };
    },
    async batch(statements: BatchStatement[]) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => {
          const result = sqlite
            .prepare(statement.sql)
            .run(...(statement.params as Array<string | number | bigint | null | Uint8Array>));
          return {
            success: true,
            results: [],
            meta: { changes: Number(result.changes), duration: 0 },
          };
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  Object.defineProperty(db, "$client", { value: d1 });
  return db;
}
