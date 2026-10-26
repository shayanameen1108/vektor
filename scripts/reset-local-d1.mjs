// Deterministic e2e runs: wipe the local D1 state so every smoke/e2e run
// starts from the migrations in `db/migrations/` alone, then re-applies them. Without
// this, the preview database accumulates every user/company ever created by
// the suite, which makes admin-console listings (and axe scans over them) grow
// unboundedly. Local dev data is disposable by design.
//
// Void's Vite plugin persists Miniflare state under `.void/` (not `.wrangler/`).
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const voidD1 = join(root, ".void", "v3", "d1");
const wranglerD1 = join(root, ".wrangler", "state", "v3", "d1");

rmSync(voidD1, { recursive: true, force: true });
rmSync(wranglerD1, { recursive: true, force: true });
console.log("[reset-local-d1] wiped local D1 state (.void + .wrangler)");

const wrangler = join(root, "node_modules", ".bin", "wrangler");
const node = process.execPath;
execFileSync(node, [join(root, "scripts", "ensure-void-wrangler.mjs")], {
  cwd: root,
  stdio: "inherit",
});
execFileSync(
  wrangler,
  [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "-c",
    ".void-wrangler.jsonc",
    "--persist-to",
    ".void",
  ],
  {
    cwd: root,
    stdio: "inherit",
  },
);
console.log("[reset-local-d1] applied D1 migrations");
