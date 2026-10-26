# Vektor

South African tender compliance for contractors. Sign up, set up a company profile, keep Tax / COIDA / B-BBEE documents current, analyse a tender PDF, and pay for credits by EFT.

Runs on Cloudflare Workers with TanStack Start, D1, R2, better-auth, and shadcn/ui.

Production: [vektorhq.co.za](https://vektorhq.co.za)

Each thing is written down once:

| What                      | Where                               |
| ------------------------- | ----------------------------------- |
| What the product does     | GitHub Issues, then `docs/adr/`     |
| The words it uses         | `GLOSSARY.md`                       |
| How code is judged        | `CODING_STANDARDS.md`               |
| What agents need          | `AGENTS.md`                         |
| Bindings and environments | `void.config.ts` / `void.lock.json` |
| Secrets                   | `docs/local.env.example` → `.env`   |
| Colours, radius, and type | `src/styles.css`                    |
| Prices                    | `src/lib/billing-catalog.ts`        |

## Setup

[Vite+](https://viteplus.dev) (`vp`) runs everything: it uses the Node in `.node-version` and the pnpm in `package.json`, and ships Vite, Vitest, Oxlint, and Oxfmt as one set, pinned in `pnpm-workspace.yaml`. `vp install` also sets up the pre-commit hook, which checks what is staged. `postinstall` runs `void prepare` for Void codegen. Run Void's own commands through `vp exec void ...`; its docs ship in `node_modules/void/docs/` (start with `guide/quickstart.md` and `reference/cli.md`). Dependencies track the versions vetted across the four sibling projects rather than latest tags. The Better Auth packages remain paired at their schema-compatible pins; auth upgrades require a separate migration review.

```sh
curl -fsSL https://vite.plus | bash   # once per machine
vp install
vp run dev                            # applies local D1 migrations, then http://127.0.0.1:5173
```

Copy [`docs/local.env.example`](docs/local.env.example) to `.env` if it is not created for you (Void only loads `.env`; there is no root `.env.example`). Its `ENVIRONMENT="local"` keeps local runs off outside services ([`src/lib/ports.ts`](src/lib/ports.ts)): email lands in an in-memory mailbox (`GET /api/dev/mail`) instead of Resend, and tender analysis uses a deterministic stand-in instead of the Workers AI binding. Production sets no `ENVIRONMENT`, so it always uses Resend and Workers AI.

`.env` is local development only: never commit it and never upload it. In production, each non-`VITE_*` key in `env.ts` is a Worker secret set with `vp exec void secret put`; any `VITE_*` client keys added later take their production value from the build/deploy shell — builds ignore `VITE_*` values in `.env`. Module-scope code (Better Auth, the port adapters in `src/lib/ports.ts`) intentionally reads the native `cloudflare:workers` env — `void/env` needs a request context.

## Commands

```sh
vp check                   # format, lint, and type check (vp check --fix to fix)
vp run check:tokens        # every colour and size is a token from src/styles.css
vp test                    # Vitest unit tests
vp run test:tooling        # node:test checks for the repo's own scripts
vp run test:smoke         # resets local D1, builds, then the public pages and the credit chain in the installed Chrome
vp build                   # Cloudflare Workers production build
vp preview                 # the production build, locally
vp run deploy              # void deploy --platform cloudflare
vp run db:migrate:local    # or db:migrate:remote
vp run seed:admin          # first admin (ADMIN_EMAIL / ADMIN_PASSWORD required)
vp run clean               # generated output
```

UI uses shadcn/ui (`base-nova`). Add components with the installed CLI:

```sh
vp exec shadcn add button --yes
```

Stock generated components keep upstream ARIA `role` attributes — the one a11y rule that disagrees is exempted under `src/components/ui/**` and `src/hooks/**` only; application code is still checked in full.

CI ([`.github/workflows/check.yml`](.github/workflows/check.yml)) runs `vp check`, `vp run check:tokens`, `vp test run` and `vp run test:smoke` on Ubuntu for every pull request and every push to `main`. The smoke run needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`: `ai.remote: true` in `void.config.ts` starts the remote Workers AI proxy in preview even though `.env` from `docs/local.env.example` sets `ENVIRONMENT="local"`, which swaps Resend and Workers AI analysis for the local mailbox and the tender stand-in. It opens the public pages and the one chain that spends a credit, in the installed Chrome. On failure, the job uploads Playwright traces as the `playwright-traces` artifact.

## Deploy

GitHub Actions deploys: the `deploy` job in [`.github/workflows/check.yml`](.github/workflows/check.yml) runs `vp run deploy` on every push to `main`, and only after Check passes, so a change whose tests fail never reaches production. Pull requests are checked, not deployed. Cloudflare builds nothing itself: the Worker is not connected to Git.

The job reads these from the repository's **Settings → Secrets and variables → Actions**:

| Name                    | Kind     | Purpose                                                                  |
| ----------------------- | -------- | ------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Secret   | User API token from the "Edit Cloudflare Workers" template, Work account |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | The Work account                                                         |

`vp run deploy` also works from a laptop after `vp exec void cloudflare login` (or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`).

Void deploy validates and applies pending D1 migrations; `vp run db:migrate:remote` still applies them explicitly ahead of a deploy but is no longer the only application path. Both `db:migrate:*` scripts call `scripts/ensure-void-wrangler.mjs`, which materializes `.void-wrangler.jsonc` through Void's public `voidPlugin()` factory — synchronous, no server — and fails closed. Wrangler runs the apply because existing local and remote history lives in its `d1_migrations` table and `--persist-to .void` state; Void's own migration history (`_void_migrations`) is not a drop-in replacement.

## Production secrets

Set these with `vp exec void secret put` (or the dashboard) before the first deploy. Do not put them in `void.config.ts`.

| Secret                                         | Purpose                                      |
| ---------------------------------------------- | -------------------------------------------- |
| `BETTER_AUTH_SECRET`                           | Session signing (≥32 chars)                  |
| `BETTER_AUTH_URL`                              | Public origin, e.g. `https://vektorhq.co.za` |
| `APP_URL`                                      | Same public origin (email links, referrals)  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`    | Google OAuth (Cloud Console → Credentials)   |
| `RESEND_API_KEY`                               | Transactional email                          |
| `EMAIL_FROM` or `SENDER_NAME` + `SENDER_EMAIL` | Default `Vektor <no-reply@vektorhq.co.za>`   |
| `EFT_BANK_NAME`                                | Shown on billing                             |
| `EFT_ACCOUNT_HOLDER`                           |                                              |
| `EFT_ACCOUNT_NUMBER`                           |                                              |
| `EFT_BRANCH_CODE`                              |                                              |
| `EFT_ACCOUNT_TYPE`                             | Defaults to `Cheque` if unset                |

The Worker name is `vektor`. Workers AI is enabled via the `AI` binding in `void.config.ts`. The account must have Workers AI on.

After secrets: `vp run db:migrate:remote`, then deploy.
