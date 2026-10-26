# Coding standards

The judgement calls a reviewer checks. Anything mechanical is a check instead: `vp check`, which formats, lints, and type checks; `scripts/check-tokens.mjs` (no colour or arbitrary value outside `src/styles.css`, and spacing on the 4px grid); the tests; and CI (`.github/workflows/check.yml`).

## Sources of truth

GitHub Issues, then `docs/adr/`, then `GLOSSARY.md`. Name things with the glossary's terms and none of its _Avoid_ words. A change that contradicts an ADR waits for approval. A Catalog price, the five Credits on a new Company, a Verdict threshold, and a Referral amount or cap wait for approval too. Those live in the code.

## Stack first

Use Cloudflare (Workers, D1, R2, Workers AI), TanStack Start, shadcn, Drizzle, and better-auth before writing code or adding a library. Custom code that stays carries one line saying why the stack cannot do it. A package a shadcn component imports as written stays while that component does.

## Design

- shadcn first: a component shadcn has is added with its CLI and used as written; it changes only through the tokens in `src/styles.css` and its variants.
- A link that goes to a page is a link. A button is the one action on the screen. A row of buttons that only navigate is a list of links.
- Copy uses the glossary's words.
- One primary action a screen; a price as a Catalog line; a loading, an empty, and an error state for every list.

## Shape

- A rule that spends a Credit, scores a Tender, confirms an EFT, or grants a Referral lives in `src/lib`. The route passes the request to it.
- An abstraction earns its place by removing duplication in three or more places.
- Config states only what differs from a default.
- A write that depends on what it read carries that condition into the write, as the Credit update does with `credits > 0`.

## Tests

- Drive the public functions and assert what a caller can observe: a Credit balance, a Verdict, a confirmed or rejected EFT.
- Near-duplicates become one table-driven test.
- Smoke tests cover the public pages and the one chain that spends a Credit, in the installed Chrome, against the preview server.

## Commits

One concern per commit, and every check passes after each.
