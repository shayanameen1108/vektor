# Evidence for fresh-2026-10-21 review

Baseline `0ad39d23f1cc7aa21ae6072712b8f8a0be8d5ac8`, branch `review/fresh-2026-10-21`. Captured 2026-10-21. All commands ran in a disposable `git archive` checkout (`git init` + `git add -A`, `node_modules` linked to installed dependencies, `void prepare` local codegen). No `.env` copied; no remote or production resource touched; database probes only touched scratch local databases created inside disposable checkouts. Raw unabridged collection: `/Users/sfx/phase1-evidence/` (not part of this repository).

## Command logs (ANSI-stripped; exit code in `.exit`)

- `check.log` — `vp check`, exit 0
- `check-tokens.log` — `vp run check:tokens`, exit 0
- `test.log` — `vp test run`, exit 0 (265 tests, 19 files)
- `test-tooling.log` — `vp run test:tooling`, exit 0
- `build.log` — `vp build`, exit 0

## Migration compatibility logs

- `wrangler-migrate.log` — existing `vp run db:migrate:local` on fresh scratch DB, exit 0 (5 migrations)
- `void-migrate-after-wrangler.log` — `WORKER_TARGET=local vp exec void db migrate` on that Wrangler-initialized DB, exit 1 ("no Void migration history", lists `d1_migrations`)
- `void-db-migrate-1.log` / `void-db-migrate-2.log` — same command twice on an empty scratch DB: applied 5 migrations, then "All migrations are up to date", exit 0

## Frozen inputs

- `dependency-snapshot.json`, `dependency-table.md` — generated frozen dependency metadata (41 package/tool rows)
- `github-maintenance.json` — GitHub repo maintenance fields per package (raw `gh api repos/...` fields)
- `skills-symlinks-and-inventory.txt`, `skills-diff-summary.txt`, `skills-upstream-head.txt` — agent-skills capture vs upstream `mattpocock/skills@5beb35b`
