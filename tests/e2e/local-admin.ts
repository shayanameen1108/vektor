import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Promote a freshly created local Playwright user without exposing an HTTP privilege hook. */
export function promoteLocalUserToAdmin(email: string): void {
  const baseURL = process.env.E2E_BASEURL ?? "http://127.0.0.1:4173";
  const hostname = new URL(baseURL).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
    throw new Error("Refusing to mutate D1 for a remote E2E_BASEURL");
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) throw new Error("A valid email is required");
  const sqlEmail = normalized.replaceAll("'", "''");
  const wrangler = resolve(process.cwd(), "node_modules/.bin/wrangler");
  execFileSync(
    wrangler,
    [
      "d1",
      "execute",
      "DB",
      "--local",
      "--command",
      `UPDATE user SET role = 'admin', updatedAt = unixepoch() WHERE lower(email) = '${sqlEmail}';`,
    ],
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

export function isLocalE2E(): boolean {
  const hostname = new URL(process.env.E2E_BASEURL ?? "http://127.0.0.1:4173").hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}
