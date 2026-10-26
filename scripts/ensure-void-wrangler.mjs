// Materialize `.void-wrangler.jsonc` from the current `void.config.ts` so
// Wrangler D1 commands work without a root wrangler.jsonc (Void owns that
// config now). Fail closed: never fall back to raw lock text (wrong target).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { voidPlugin } from "void";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".void-wrangler.jsonc");

// Public factory: writes the config from process.cwd() synchronously, no server.
process.chdir(root);
voidPlugin();

if (!existsSync(out)) {
  console.error("[ensure-void-wrangler] failed to write .void-wrangler.jsonc");
  process.exit(1);
}
