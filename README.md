# Vektor

South African tender compliance for contractors. Sign up, set up a company profile, keep Tax / COIDA / B-BBEE documents current, analyse a tender PDF, and pay for credits by EFT.

Runs on Cloudflare Workers with TanStack Start, D1, R2, better-auth, and shadcn/ui.

Production: [vektorhq.co.za](https://vektorhq.co.za)

## Setup

```bash
mise install
mise run setup
nub run dev
```

Copy `.dev.vars.example` to `.dev.vars` if it is not created for you. All email goes through Resend (`RESEND_API_KEY` required, even locally). Tender analysis uses the Workers AI binding — wrangler must be logged in to the Cloudflare account.

## Commands

- `nub run dev` — Vite + local D1 migrate
- `nub run build` — Cloudflare Workers build
- `nub run preview` — production build on :4173
- `nub run deploy` — build and `wrangler deploy`
- `nub run deploy:preview` — `wrangler versions upload`
- `nub run db:migrate:local` / `nub run db:migrate:remote`
- `nub run seed:admin` — first admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` required)
- `nub run check` — typecheck, lint, format, unit, e2e, build
- `nub run clean` — generated output

UI uses shadcn/ui (`base-nova`). Add components with:

```bash
nubx shadcn@latest add button --yes
```

## Production secrets

Set these with `wrangler secret put` (or the dashboard) before the first deploy. Do not put them in `wrangler.jsonc`.

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

The Worker name is `vektor`. Workers AI is enabled via the `AI` binding in `wrangler.jsonc`. The account must have Workers AI on.

After secrets: `nub run db:migrate:remote`, then `nub run deploy:preview` for a smoke run, then `nub run deploy`.
