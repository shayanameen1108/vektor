# Cloudflare Workers is the production host

Production is Cloudflare Workers at https://vektorhq.co.za, deployed by GitHub Actions from `main` only after check passes. The Worker is not connected to Git. Workers Builds was rejected because it shipped `main` whether or not the tests had passed.

**Amended (2026-10): Void replaces Wrangler-first deploy.** Config lives in `void.config.ts` / `void.lock.json` (TanStack Start + `voidPlugin()`, `env.ts` for the server env schema). CI runs `void deploy --platform cloudflare` with `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. The existing Worker name, custom domains, D1, R2, AI, and cron stay the same; D1 migrations live in `db/migrations/`; Compliance Guardian is a Void cron job in `crons/compliance-guardian.ts` (`0 6 * * *` UTC). Void deploy now validates and applies pending D1 migrations, so `db:migrate:remote` can still apply them explicitly before a deploy but is no longer the only application path.
