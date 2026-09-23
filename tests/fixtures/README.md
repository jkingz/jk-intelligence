# fixtures

Data builders for the integration tier. **Empty by design** — this directory currently holds no code
because the first integration slice has not landed (see the note in
`context/progress-tracker.md`). This file records what it will need, so the shape is decided before
the first test forces it.

## Environment

`.env.test` at the repo root, untracked — `.gitignore:36`'s `.env*` pattern already covers it. It is
not loaded by Vitest the way Next's CLI loads it, so `tests/helpers/load-test-env.ts` reads it via
`process.loadEnvFile`.

Four variables, all `TEST_`-prefixed. The prefix is load-bearing, not cosmetic: `loadEnvFile` never
overwrites a variable the shell already exports, so a name shared with the development config would
leave the "isolated" tier pointed at the live project, silently.

| name | role |
|---|---|
| `TEST_SUPABASE_URL` | presence of this one is what `hasTestDb` reports |
| `TEST_SUPABASE_PUBLISHABLE_KEY` | the key the per-request RLS client is built with |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | fixture provisioning only; bypasses RLS, so it must never reach an assertion |
| `TEST_DEMO_PASSWORD` | shared password for the fixture users |

## Fixture users

Three, so cross-tenant denial is an observation rather than an assumption:

| user | `users.role` | owns | proves |
|---|---|---|---|
| `client@a` | `client` | client A | the happy path |
| `client@b` | `client` | client B | B cannot read A — the actual isolation claim |
| `staff@a` | `staff` | client A (non-owner) | staff visibility is not ownership |

Provision with service-role `auth.admin.createUser`, the mechanism `scripts/create-demo-user.mjs:57`
already uses. Roles are set on the `users` row and read back through the `security definer` helpers —
never from a JWT claim (`AGENTS.md`, "Tenant isolation").

## Seeding

Row inserts go through the service-role client, then every assertion runs through the user-scoped one.
A test that reads with the same privilege it wrote with proves nothing about RLS.
