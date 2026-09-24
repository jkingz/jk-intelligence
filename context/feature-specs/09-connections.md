# Connections (read-only)

## Goal
Per reporting client, show which data sources are linked — and say plainly which providers
cannot be connected yet and why.

## What this is not
- No credential writes. No insert/update/delete policy exists on `api_credentials` for any
  role but `service_role`, and the Connect control is rendered `disabled` with its reason in
  the copy. Rationale: nothing consumes the sync queue (`worker.ts` -> `mock_completed`,
  Open Question 2), so a stored Google/Meta token would be a live credential with no reader.
- No new sources. `google_ads` / `meta_ads` are display catalog entries only; adding a value
  to `api_credentials_source_check` or `SOURCES` touches `persist_metrics` and every metrics
  read, and belongs to the sync work.
- No OAuth. Google and Meta are OAuth-only, so "paste your key" would be false for both;
  the static-token case that exists today is Semrush.

## Data and tenancy
- One migration: `api_credentials` loses `using (false)`, gains
  `api_credentials_select_tenant_or_admin` — the same `private.current_user_role()` /
  `current_user_client_id()` predicate as `clients_select_authenticated`. No TypeScript
  helper re-derives ownership (`RULES.md` section 15).
- `listConnections()` reads `clients` then `api_credentials`, both through the cookie-bound
  client, and selects `client_id, source, created_at`. It is never wrapped in
  `unstable_cache`: a cookie-bound client inside a function keyed on nothing is the
  cross-user leak the tenant-gate change closed (invariant 4-5).
- `/connections` is dynamic (`ƒ`) by design. It awaits the session cookie.

## Accepted limitations
- The select policy is row-level, so `credential_reference` is selectable by a tenant that
  can see the row. Tolerated because the column holds an opaque Vault *reference* rather than
  a secret, nothing in the app decrypts it, and no response, log or cache entry carries it.
  Column-level protection is the follow-up if a real reference is ever written.
- `api_credentials` records that a link exists and when. It carries no health, scope or
  expiry, so "Linked" means linked, not working.

## Empty and error states
- No visible client: one card, "No reporting client is assigned to your account yet."
- Client with no credentials: every row "Not connected".
- Database unreachable: the read throws "Database operation failed"; the page is a server
  component with no try/catch, so Next's error boundary renders it. Deliberate: inventing a
  per-page error shell here would be a second error surface.

## Verification
`tests/tenant-isolation/unit/connections-status.test.ts`,
`tests/tenant-isolation/unit/connections-read.test.ts` (incl. "never the admin client",
"never selects the reference"), `tests/platform/unit/connections-catalog.test.ts`,
`tests/tenant-isolation/integration/credentials-visibility.test.ts` (live RLS, `skipIf` —
written, and labelled as not yet executed).
