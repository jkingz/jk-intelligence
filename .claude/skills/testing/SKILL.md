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

Unit tier only, and only at the I/O boundary: `@/lib/agents/...`, `@/lib/db/repository`. Never inside
business logic, never a real network or DB call. The integration tier exists precisely to put a real
Postgres behind `canAccessClient` — do not mock there.

## Coverage every route handler needs

`401` unauthenticated · `403` not this caller's client · `400` malformed id · **no-data-before-auth**
(the handler checks identity before it reads). Route tests live in `<name>-route.test.ts`.
Ownership and isolation need a two-tenant fixture proving a foreign id cannot be read.

## Running

```bash
pnpm test                 # unit project
pnpm test:all             # + integration, against the local stack
pnpm test:e2e             # public browser tier
pnpm test tests/dashboard # one folder
```

## What the integration tier covers today

Three files, all `skipIf(!TEST_SUPABASE_URL)`: `rls-gate.test.ts` and
`credentials-visibility.test.ts` (live RLS on `clients` and `api_credentials`, including the column
grant that denies `credential_reference` with `42501`), plus
`tests/admin/integration/provisioning.test.ts` (the five admin definer RPCs). Quote the collected
count rather than the file list if you need a number.

- Contract lives in `AGENTS.md § STANDING RULES 13` and `§ Code Standards → Testing`.
