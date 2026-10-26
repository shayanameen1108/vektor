// Preflight for reproducible local/e2e runs: ensure `.dev.vars` exists so
// `vite build` copies it into `dist/server/.dev.vars` and `vite preview`
// serves with it. Idempotent — never overwrites an
// existing `.dev.vars` (that file may hold real local secrets).
import { existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".dev.vars");
const example = join(root, ".dev.vars.example");

if (existsSync(target)) {
  console.log("[ensure-dev-vars] .dev.vars already present — leaving untouched");
} else if (existsSync(example)) {
  copyFileSync(example, target);
  console.log("[ensure-dev-vars] created .dev.vars from .dev.vars.example");
} else {
  console.error("[ensure-dev-vars] .dev.vars.example missing — cannot create .dev.vars");
  process.exit(1);
}
