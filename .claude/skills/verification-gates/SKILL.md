---
name: verification-gates
description: The command chain that must be green before work is reported complete, and how to report each gate.
---

# Verification Gates

## The chain, in this order

1. **Tests** — `pnpm test` (the Vitest **unit** project, not the suite). Name the tier a run covered.
   - Integration tier: `pnpm test:all` — needs `pnpm exec supabase start` and a filled `.env.test`.
   - Browser tier: `pnpm test:e2e`.
   - A green integration tier can mean **nothing ran**: all three files `skipIf(!TEST_SUPABASE_URL)`,
     so read the passed/skipped counts, never the exit code.
   - Narrow with `pnpm test <path>`, never `pnpm test -- <path>` — the second form silently runs
     everything.
2. **Typecheck** — `pnpm typecheck` (runs `next typegen` first). Proves types, not behavior.
3. **Lint** — `pnpm lint`.
4. **Build** — `pnpm build`. Anything the build fetches over the network is a latent CI failure.
5. **Live exercise** — when a test cannot reach it (a page, a migration, a queue job), exercise it
   and report the observation. "It should work" is not a status.

## Reporting

For each gate: the command, its output or count, and its state — pass, fail, or waived with the
reason a tier could not run.

```
Tests: pnpm test → <count> passed, 0 failed
Typecheck: pnpm typecheck → No errors found
Lint: pnpm lint → No problems reported
Build: pnpm build → <n> pages, 0 errors
Live: /connections served a seeded tenant's three sources, status columns only
```

Fill `<count>` and `<n>` from the run in front of you. They are report-format holes, not literals —
typing a number from memory or from an older doc is the defect this skill exists to prevent.

`.github/workflows/ci.yml` runs 1–4 plus the public e2e tier on every push to `main`/`dev` and on
pull requests. The credential-gated integration tier is the gap CI does not close; say so when a
green CI is offered as evidence.

## A gate that only passes on this machine is not a gate

Prove the build is hermetic before trusting a warm cache:
`NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 pnpm build`.

- The contract is `docs/conventions/project-rules.md` § PROJECT RULES 13; read that, not this file. Its four-chain gates
  *reporting work complete*; its push-gate bullet gates *pushing and opening a PR*, with three
  outcomes — green, waived, red. The probe above is this skill's own addition — PROJECT RULES 13 names the
  commands, not the egress-blocked rerun.
