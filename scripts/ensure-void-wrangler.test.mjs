import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bridgeSource = join(repoRoot, "scripts", "ensure-void-wrangler.mjs");
const repoNodeModules = join(repoRoot, "node_modules");

const TARGETS = {
  local: {
    name: "fixture-local",
    vars: { ENVIRONMENT: "local" },
    routes: [{ pattern: "local.fixture.test", custom_domain: true }],
    d1_databases: [
      {
        binding: "DB",
        database_name: "fixture-local-db",
        database_id: "00000000-0000-4000-8000-000000000001",
        migrations_dir: "./db/migrations",
      },
    ],
    r2_buckets: [{ binding: "STORAGE", bucket_name: "fixture-local-bucket" }],
  },
  staging: {
    name: "fixture-staging",
    vars: { ENVIRONMENT: "staging" },
    routes: [{ pattern: "staging.fixture.test", custom_domain: true }],
    d1_databases: [
      {
        binding: "DB",
        database_name: "fixture-staging-db",
        database_id: "00000000-0000-4000-8000-000000000002",
        migrations_dir: "./db/migrations",
      },
    ],
    r2_buckets: [{ binding: "STORAGE", bucket_name: "fixture-staging-bucket" }],
  },
  production: {
    name: "fixture-production",
    vars: { ENVIRONMENT: "production" },
    routes: [{ pattern: "fixture.test", custom_domain: true }],
    d1_databases: [
      {
        binding: "DB",
        database_name: "fixture-production-db",
        database_id: "00000000-0000-4000-8000-000000000003",
        migrations_dir: "./db/migrations",
      },
    ],
    r2_buckets: [{ binding: "STORAGE", bucket_name: "fixture-production-bucket" }],
  },
};

const configSource = `import { defineConfig } from "void/config";

const targets = ${JSON.stringify(TARGETS, null, 2)};

export default defineConfig({
  target: "cloudflare",
  cloudflare: {
    account_id: "0000000000000000000000000000beef",
    workers_dev: false,
    ...targets[process.env.FIXTURE_TARGET ?? "local"],
  },
});
`;

function makeFixture(t, { configText = configSource, withVoid = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ensure-void-wrangler-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(bridgeSource, join(dir, "scripts", "ensure-void-wrangler.mjs"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "fixture", type: "module", private: true }),
  );
  if (withVoid) symlinkSync(repoNodeModules, join(dir, "node_modules"), "junction");
  else mkdirSync(join(dir, "node_modules"));
  writeFileSync(join(dir, "void.config.ts"), configText);
  return dir;
}

function writeLock(dir, cloudflare) {
  const resolved = { ...cloudflare, void_managed_extra: true };
  const lock = {
    version: 1,
    source: cloudflare,
    resolved,
    text: `${JSON.stringify(resolved, null, 2)}\n`,
  };
  writeFileSync(join(dir, "void.lock.json"), JSON.stringify(lock, null, 2));
}

function runBridge(fixture, { env = {}, cwd = tmpdir() } = {}) {
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv)) {
    if (/^(VOID|CLOUDFLARE|WORKER|FIXTURE)_/.test(key)) delete cleanEnv[key];
  }
  return spawnSync(process.execPath, [join(fixture, "scripts", "ensure-void-wrangler.mjs")], {
    cwd,
    env: { ...cleanEnv, ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
}

const generatedPath = (dir) => join(dir, ".void-wrangler.jsonc");
const readGenerated = (dir) => JSON.parse(readFileSync(generatedPath(dir), "utf8"));

const PRIOR_TARGET = { local: "production", staging: "local", production: "staging" };

for (const target of Object.keys(TARGETS)) {
  void test(`selected ${target} config supersedes stale generated config and stale lock`, (t) => {
    const fixture = makeFixture(t);
    const prior = PRIOR_TARGET[target];
    writeFileSync(generatedPath(fixture), `${JSON.stringify(TARGETS[prior], null, 2)}\n`);
    writeLock(fixture, TARGETS[prior]);
    const configBefore = readFileSync(join(fixture, "void.config.ts"), "utf8");

    const result = runBridge(fixture, { env: { FIXTURE_TARGET: target } });

    assert.equal(result.status, 0, result.stderr);
    const generated = readGenerated(fixture);
    assert.equal(generated.name, TARGETS[target].name);
    assert.equal(
      generated.d1_databases[0].database_id,
      TARGETS[target].d1_databases[0].database_id,
    );
    assert.equal(
      generated.d1_databases[0].database_name,
      TARGETS[target].d1_databases[0].database_name,
    );
    assert.equal(generated.r2_buckets[0].bucket_name, TARGETS[target].r2_buckets[0].bucket_name);
    assert.deepEqual(generated.vars, TARGETS[target].vars);
    assert.deepEqual(generated.routes, TARGETS[target].routes);
    assert.equal(readFileSync(join(fixture, "void.config.ts"), "utf8"), configBefore);
  });
}

void test("config evaluation failure exits nonzero without a raw-lock fallback", (t) => {
  const fixture = makeFixture(t, {
    configText: `import { defineConfig } from "void/config";

throw new Error("fixture config exploded");

export default defineConfig({});
`,
  });
  const staleText = '{ "name": "stale-marker" }\n';
  writeFileSync(generatedPath(fixture), staleText);
  writeLock(fixture, TARGETS.production);

  const result = runBridge(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixture config exploded/);
  assert.equal(readFileSync(generatedPath(fixture), "utf8"), staleText);
});

void test("missing Void installation fails nonzero rather than copying the lock", (t) => {
  const fixture = makeFixture(t, { withVoid: false });
  const staleText = '{ "name": "stale-marker" }\n';
  writeFileSync(generatedPath(fixture), staleText);
  writeLock(fixture, TARGETS.production);

  const result = runBridge(fixture);

  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(generatedPath(fixture), "utf8"), staleText);
});
