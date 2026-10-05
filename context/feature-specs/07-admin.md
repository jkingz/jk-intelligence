# Admin: provisioning

## Goal
Turn an account that signed up but was never provisioned into a member with a role and a
client, and keep the client registry honest — without one line of TypeScript deciding who is
an admin.

## Why this exists
`public.users` has no writer in the app and there is no trigger on `auth.users`, so
`/auth/sign-up` produces a session with no `users` row. That account gets `user: null` from
`getAuthSession()`, `[]` from `listAccessibleClients()`, and an empty dashboard forever. The
panel's highest-value action is "attach this account"; the client registry exists so the same
admin can name the tenant it attaches to.

## What this is not
- No sync logs or run history. `sync_logs` has no production writer.
- No credential writes. `/connections` reads `client_id, source, created_at`; nothing resolves
  a stored key until the worker is hosted, so a paste box would collect a secret no code can use.
- No manual sync trigger. `POST /api/sync/trigger` would enqueue a job nothing consumes.
- No invitations or join codes. No email transport, no token lifecycle.
- No left-rail row. `/admin` is a protected prefix, not a destination, so
  `activeDestination("/admin")` returns `null` and the rail renders with nothing active. The
  entry point is the Admin item in `AccountMenu`, shown only when `profile.role === "admin"`.
- No hard delete on a client. `api_credentials.client_id … on delete cascade` and
  `users.client_id … on delete set null` mean deleting a client destroys its credentials and
  un-homes its members. Deactivate instead.

## Writes
Five `security definer` functions in `public`, all reached with the user-scoped client
(`createServerSupabaseClient()`), all opening with the same role guard, and zero new table
grants:

| Function | Effect |
| --- | --- |
| `admin_directory()` | projects `auth.users` id/email/name/created_at — the half RLS cannot see |
| `admin_create_client(p_name, p_domain)` | insert, domain `lower(trim())`ed |
| `admin_update_client(p_id, p_name, p_is_active)` | partial update; **no domain parameter at all** |
| `admin_attach_member(p_user_id, p_role, p_client_id)` | upsert on the auth id; admin ⇒ `client_id = null` |
| `admin_detach_member(p_user_id)` | delete; `45002` when no row matched |

The guard is `if private.current_user_role() is distinct from 'admin' then raise exception
'admin privilege required' using errcode = '42501'`, and it must be the first statement, because
a definer function bypasses RLS. `pg_advisory_xact_lock(800100)` serialises the last-admin rule
in attach and detach.

Domain is immutable by construction: `lower(domain)` is both the unique index
(`clients_domain_key`) and `scripts/seed.mjs`'s upsert key, so an admin edit would make the next
seed insert a duplicate client.

## Reads
`getAdminView()` returns `{ clients, members }`. `clients` is a direct `clients`
select with **no `is_active` filter** — `listAccessibleClients()` filters it, which would make
Pause irreversible. Every email and display name the panel renders comes from the directory,
because `public.users` stores neither. Members is the join of `users` and `directory` by `id`;
the Attach list is the set difference; the per-client count is grouped in TypeScript.
Nothing here decides visibility; Postgres already did.

## Errors
`lib/admin/errors.ts` maps the Postgres code to a status and a string, and it is the only
source of error copy in this feature: zod → 400, `23505` → 409, `45001` → 409, `23503` → 409,
`45002` → 409, `42501` → 403, `23514` → 500, anything else → 502. `callAdminRpc` preserves
`error.code` — the shared `databaseOperation()` wrapper erases it, which is why admin writes do
not use it. Refresh only on 2xx: after a refusal the server data is already correct.

## States
Bootstrap is the normal state: one admin from `create-demo-user.mjs --admin`, no other
`users` rows, clients full of seed data. An unassigned member renders "Unassigned", not an
error. No control hides itself based on who you are — your own row still offers Detach and
Postgres answers `45001`.

## Limits accepted out loud
Two admins editing one client is last-write-wins (`clients` has no `updated_at`; none added).
A signed-in non-admin hitting `/admin` is redirected, not shown a 403 page. The directory stops
at `max_rows = 1000`. Browser specs never write, so nothing asserts that pressing *Create
client* in a browser round-trips; the unit tier owns the handler, the integration tier owns the
function.
