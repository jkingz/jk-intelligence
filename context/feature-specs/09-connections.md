# Connections (read-only)

## Goal
Per reporting client, show which data sources are linked — and say plainly which providers
cannot be connected yet and why.

## What this is not
- No credential writes. No insert/update/delete policy exists on `api_credentials` for any
  role but `service_role`, and the Connect control is rendered `disabled` with its reason in
  the copy. Rationale: nothing consumes the sync queue (`worker.ts` -> `mock_completed`,
  Open Question 2), so a stored Google/Meta token would be a live credential with no reader.
- Which rows carry that control, exactly — the page is not inconsistent here. The three
  enum-backed sources (`gsc`, `ga4`, `semrush`) each render a `disabled` Connect with the reason
  in its `title`, because each is storable in `api_credentials` today and only the *write path*
  is missing. The two display-only providers (`google-ads`, `meta-ads`) render **no control at
  all**: a greyed button on a source that has no key-paste flow is the fake affordance the
  scoping decision ruled out.
- No new sources. `google_ads` / `meta_ads` are display catalog entries only; adding a value
  to `api_credentials_source_check` or `SOURCES` touches `persist_metrics` and every metrics
  read, and belongs to the sync work.
- No OAuth. Google and Meta are OAuth-only, so "paste your key" would be false for both;
  the static-token case that exists today is Semrush.

## Data and tenancy
- One policy migration: `api_credentials` loses `using (false)`, gains
  `api_credentials_select_tenant_or_admin` — the same `private.current_user_role()` /
  `current_user_client_id()` predicate as `clients_select_authenticated`. No TypeScript
  helper re-derives ownership (`RULES.md` section 15). The grant that decides which *columns*
  that row policy can reach is a second migration, the bullet below.
- `listConnections()` reads `clients` then `api_credentials`, both through the cookie-bound
  client, and selects `client_id, source, created_at`. It is never wrapped in
  `unstable_cache`: a cookie-bound client inside a function keyed on nothing is the
  cross-user leak the tenant-gate change closed (invariant 4-5).
- `/connections` is dynamic (`ƒ`) by design. It awaits the session cookie.
- Column privileges narrow that row-level policy. `20261010000000_credential_reference_unselectable.sql`
  revokes `authenticated`'s table-wide `select` on `api_credentials` and grants it back on
  `client_id`, `source`, `created_at` only, so a live tenant session that names `credential_reference`
  through PostgREST gets `42501 permission denied for table api_credentials` — no schema-cache reload
  needed. That SQLSTATE is asserted by the negative case in
  `tests/tenant-isolation/integration/credentials-visibility.test.ts`, so the code the docs quote is
  the code the database actually returns. `id` is ungranted too (no caller reads it), and `select *`
  is refused rather than quietly shrunk to the granted columns (verified directly:
  `set role authenticated; select * from public.api_credentials` → `42501`). **Applied to the local
  stack only**; the hosted apply needs King's own yes, as every hosted migration here does.

## Closed and accepted
- Closed 2026-10-12: the row-level policy used to leave `credential_reference` selectable by any
  tenant that could see the row. Acceptable while it stood because the column holds an opaque Vault
  *reference* and not key material, nothing in the app decrypts it, and no response, log or cache
  entry carries it. `20261010000000_credential_reference_unselectable.sql` closes it at the column
  (local stack only, per the bullet above). Note where the grant lives afterwards:
  `pg_class.relacl` holds **no** `authenticated` entry at all — the three columns are in
  `pg_attribute.attacl`, visible through `information_schema.column_privileges` and testable with
  `has_column_privilege`. An `aclexplode(relacl)` audit returning zero rows for `authenticated` is
  the narrowing working, not a missing grant.
- `api_credentials` records that a link exists and when. It carries no health, scope or
  expiry, so "Linked" means linked, not working.

## Empty and error states
- No visible client: two cards, not one — the empty-client card, "No reporting client is assigned to your
  account yet.", and the "Not available yet" card, which renders unconditionally.
- Client with no credentials: every row "Not connected".
- Database unreachable: the read throws "Database operation failed"; the page is a server
  component with no try/catch, so Next's error boundary renders it. Deliberate: inventing a
  per-page error shell here would be a second error surface.

## Verification
`tests/tenant-isolation/unit/connections-status.test.ts`,
`tests/tenant-isolation/unit/connections-read.test.ts` (incl. "never the admin client",
"never selects the reference"), `tests/platform/unit/connections-catalog.test.ts`,
`tests/tenant-isolation/integration/credentials-visibility.test.ts` (live RLS, `skipIf` — executed
against the local stack 2026-09-25: 4 tests green alongside `rls-gate.test.ts`'s 5; re-executed
2026-10-12 on the migrated local stack, now **6** tests — the reference-denied pair included — and
the whole `integration` tier printed `21 passed / 0 skipped`).
The tier above is executable and re-runnable. This next line is **a dated manual observation, not a
check the repo can reproduce**: on 2026-10-12 the page was read in a browser against the migrated
local database as the fixture tenant `client@a.rls-test.local` — `Search console (GSC)` → Not
connected, `Analytics (GA4)` → Not connected, `Semrush` → Linked Sep 25, 2026, and no `vault:` string
reached the DOM. Treat it as evidence of that day's state, and re-run the tier for anything newer.
