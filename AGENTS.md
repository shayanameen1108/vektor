## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Shared stack

- Prefer upstream-supported defaults and public APIs across these four projects. Keep a different approach only for a product requirement or an upstream limitation, and record the reason in the existing README or ADR. Preserve deployed resource identities and migration history when changing tooling.
- Vite+ owns development, build, formatting, linting, typechecking, and unit tests. Use the repository's scripts and verification commands in `README.md`; preserve product-specific test seams and deployment gates.
- Before changing Void resources, configuration, environment handling, or deployment, read the matching installed docs in `node_modules/void/docs/`. Start with `guide/quickstart.md`, `integrations/frameworks/tanstack-start.md`, and `reference/cli.md`, then follow the relevant command reference. Void owns resources and deploy; TanStack Start owns routing and SSR. Keep Better Auth integrated directly with TanStack Start while Void-managed auth is unsupported in framework mode.
- Follow `guide/env-vars.md` for `env.ts`, typed `void/env` access, local `.env`, build-time public `VITE_*` values, and production server secrets. Use native Cloudflare bindings where the product requires them.
- Follow the installed package's guidance before changing TanStack, Vite+, or shadcn conventions. Use the locally installed shadcn CLI; preserve generated UI components and product tokens rather than regenerating or redesigning them for consistency.
