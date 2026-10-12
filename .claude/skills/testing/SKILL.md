---
name: testing
description: Test tiers, organization, mocking boundaries, and route coverage requirements for this repo.
---

# Testing

## Organization

`tests/<feature>/<tier>/`, tiers `unit`, `integration`, `e2e`. Never beside the module. Import the
subject through `@/`, never relatively — a `./` specifier can resolve to a neighbouring file of the
same name. `tests/helpers/` is the one exception and may be imported relatively.
Name files `<sut>.test.ts` (unit/integration) or `<flow>.spec.ts` (e2e).

`AGENTS.md § Verification` owns the table of which feature folder owns which modules.

## Mocking

Unit tier only, and only at the I/O boundary: `@/lib/agents/...`, `@/lib/db/repository` —
`vi.mock("@/lib/db/repository", …)`, never an internal function, never a real network or DB call.
The integration tier exists precisely to put a real Postgres behind `canAccessClient` — do not mock
there.

Declare the spies where the factory can close over them:
`const boundary = vi.hoisted(() => ({ fn: vi.fn() }))`, and `afterEach(() => vi.resetAllMocks())`.

`vitest.config.ts` aliases `server-only` to its empty module and sets `conditions: ["react-server"]`,
so a test never needs its own `vi.mock("server-only")` — 11 of the 41 test files still carry one
(measured 2026-10-13), which is dead weight rather than a defect; drop it when you touch that file,
and do not add it to a new one.

New behavior gets a test in the same change; a bugfix gets a test that fails without the fix.

## Coverage every route handler needs

`401` unauthenticated · `403` not this caller's client · `400` malformed id · **no-data-before-auth**
(the handler checks identity before it reads) · `503` rather than a throw when the identity read, the
tenant gate, or the read itself rejects. Route tests live in `<name>-route.test.ts`.
Ownership and isolation need a two-tenant fixture proving a foreign id cannot be read — tenant
isolation is the highest-value test in the repo, so assert that B's data never appears in A's response.

Two files carry the boundary and move with it: `@/tests/sync/unit/flow.test.ts` (cron → queue handoff)
and `tests/tenant-isolation/unit/repository.test.ts` (the RLS gate contract). Change either surface and
those tests must change with it.

Component-render tests are deliberately absent. Adding a testing-library dependency is a decision to
raise with the owner, not one to make silently — the rationale is §2 of
`docs/superpowers/specs/2026-09-23-test-suite-architecture-design.md`.

## Running

```bash
pnpm test                 # unit project only
pnpm test:all             # + integration, against the local stack
pnpm test:e2e             # public browser tier
pnpm test:e2e:auth        # credential-gated tier, local only
pnpm test tests/dashboard # one folder — `pnpm test -- tests/dashboard` runs the whole tier instead
```

A filter that matches nothing exits 1, so a moved file announces itself instead of passing empty.

## What the integration tier covers today

Three files, all `skipIf(!TEST_SUPABASE_URL)`: `rls-gate.test.ts` and
`credentials-visibility.test.ts` (live RLS on `clients` and `api_credentials`, including the column
grant that denies `credential_reference` with `42501`), plus
`tests/admin/integration/provisioning.test.ts` (the five admin definer RPCs). Quote the collected
count rather than the file list if you need a number.

- Contract lives in `AGENTS.md § STANDING RULES 13` and `§ Code Standards → Testing`.
