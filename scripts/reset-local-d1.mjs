// Deterministic e2e runs: wipe the local D1 state so every `nub run test:e2e`
// starts from the migrations in `drizzle/` alone, then re-applies them. Without
// this, the preview database accumulates every user/company ever created by
// the suite, which makes admin-console listings (and axe scans over them) grow
// unboundedly. Local dev data is disposable by design.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const d1State = join(root, ".wrangler", "state", "v3", "d1");

rmSync(d1State, { recursive: true, force: true });
console.log("[reset-local-d1] wiped local D1 state");

const wrangler = join(root, "node_modules", ".bin", "wrangler");
execFileSync(wrangler, ["d1", "migrations", "apply", "DB", "--local"], {
  cwd: root,
  stdio: "inherit",
});
console.log("[reset-local-d1] applied D1 migrations");
