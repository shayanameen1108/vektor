// Preflight for reproducible local/e2e runs: ensure `.env` exists so Void
// and the Workers runtime see local secrets. Idempotent — never overwrites an
// existing `.env` (that file may hold real local secrets).
// Template lives at docs/local.env.example (Void forbids root `.env.example`).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".env");
const example = join(root, "docs", "local.env.example");
const legacyDevVars = join(root, ".dev.vars");

if (existsSync(target)) {
  console.log("[ensure-env] .env already present — leaving untouched");
} else if (existsSync(legacyDevVars)) {
  copyFileSync(legacyDevVars, target);
  console.log("[ensure-env] created .env from legacy .dev.vars");
} else if (existsSync(example)) {
  copyFileSync(example, target);
  console.log("[ensure-env] created .env from docs/local.env.example");
} else {
  console.error("[ensure-env] docs/local.env.example missing — cannot create .env");
  process.exit(1);
}

for (const legacy of [legacyDevVars, join(root, ".dev.vars.example"), join(root, ".env.example")]) {
  if (existsSync(legacy)) {
    console.warn(
      `[ensure-env] Void only supports .env — remove ${legacy.replace(root + "/", "")} so builds succeed`,
    );
  }
}
