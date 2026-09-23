# Admin provisioning: the client registry and its members, guarded in Postgres

Date: 2026-09-24 · Status: draft for review · Branch: `dev`

Implements step 12 of `docs/target-state.md:327`. Adds `context/feature-specs/07-admin.md` — the
number is 07, not 05: `01-design-system` … `06-data-export` already exist.

## 0. Two calls made rather than asked

Both are one-line reversals if you disagree.

1. **The integration matrix lands written but never executed**, gated by `describe.skipIf(!hasTestDb)`.
   This overrides the merge rule in the 2026-09-23 spec §0, which said the RLS slice would not be
   committed until it had run green once against a real stack. The rule is still right; what changed is
   that nothing here is committed, so the failure mode it guards against — a skipped test presented as
   coverage in a repo — is not the failure mode being accepted. The deviation is recorded in §7 and in
   `context/progress-tracker.md` so neither document silently contradicts the other.
   The reason to write them anyway: the substrate is a signup that can happen later, and the assertions
   are cheapest while this design is fresh in mind.
2. **`admin_directory()` is a definer function, not `auth.admin.listUsers()`.** The alternatives each
   put the service-role key in the request path, cap at 1000 rows per page, and merge two sources in
   memory. If you would rather email never be readable through SQL, this is the line to cut, and §5's
   probe becomes moot.

## 1. What is actually missing

Step 12 reads "no `components/features/admin`; clients and credentials are provisioned by SQL/seed
scripts". The interesting part is bigger than a missing folder:

- `public.users` has exactly two writers — `scripts/create-demo-user.mjs:72` (upsert) and
  `lib/agents/authAgent.ts:36` (read) — and **there is no trigger on `auth.users` in any migration**.
  An account created through the public sign-up form therefore has no `public.users` row, so
  `getAuthSession()` returns `user: null`, `listAccessibleClients()` returns `[]`, and the dashboard
  paints its empty shell. **Every self-signup is inert until someone with a psql session intervenes.**
- Turn that around and the panel's real job is not a CRUD screen; it is converting a sign-up into a
  user. The client registry is the smaller half.
- Reads for an admin already work. `clients_select_authenticated` and `users_select_self_or_admin`
  (`20260917000000_seo_poc.sql:155,162`) grant `select` on every row when
  `private.current_user_role() = 'admin'`. No migration is needed to *see* anything that is already
  provisioned.
- Writes do not exist at all. The base migration ends at `revoke all … from authenticated` plus
  `grant select`, and `20260920000001_rls_hardening.sql` strips grants from any table arriving
  RLS-disabled. Across all seven tables there is not one `for insert`, `for update` or `for delete`
  policy. So step 12 is a write-path design problem wearing a UI ticket.

## 2. Non-goals, with the reason each is out

| Excluded | Why |
| --- | --- |
| Sync logs / run history | `sync_logs` has no production writer; the worker-hosting decision (steps 4–8) is still open. UI over a column nothing writes. |
| `api_credentials` management | Nothing in the app reads the table, `credential_reference` is never produced by any code, and its select policy is `using (false)`. |
| Invitations, join codes | Declined during scoping: no email transport, no token lifecycle, no new tables. |
| Left navigation rail | Still deferred — non-admin destinations stay at five. |
| Hard `DELETE` on a client | `api_credentials.client_id … on delete cascade` and `users.client_id … on delete set null`: deleting a client silently destroys its credentials and un-homes its members. Deactivate instead. |

## 3. The write path: five definer functions, zero new table grants

One migration, `supabase/migrations/<ts>_admin_provisioning.sql`. Five `security definer` functions in
`private`, `set search_path = ''`, schema-qualified bodies, matching the two existing helpers at
`20260917000000_seo_poc.sql:126-144`. `grant execute … to authenticated` on each; **no
`grant insert/update/delete` anywhere**, so `20260920000001`'s stance survives.

Each body opens with the same guard, and it must be the first statement because a definer function
bypasses RLS:

```sql
if private.current_user_role() is distinct from 'admin'
   then raise exception 'admin privilege required' using errcode = '42501';
end if;
```

`raise`, not "return no rows": for a write, an empty result still looks like success.

| Function | Notes |
| --- | --- |
| `admin_directory()` | `select id, email, name, created_at from auth.users` — the half RLS cannot see. |
| `admin_create_client(p_name, p_domain)` | `lower(trim())` the domain, insert, return the row. `23505` propagates. |
| `admin_update_client(p_id, p_name, p_is_active)` | **No domain parameter at all.** Immutability is structural — an illegal call cannot be typed. If §10.1 cuts rename, this collapses to `admin_set_client_active(p_id, p_is_active)`. |
| `admin_attach_member(p_user_id, p_role, p_client_id)` | **Upsert**, keyed on the auth id, because sign-ups have no row to update. Promoting to `admin` forces `client_id = null` per `users_admin_has_no_tenant`. |
| `admin_detach_member(p_user_id)` | Deletes the `public.users` row, returning the account to inert. |

`lower(domain)` is load-bearing in two places at once: it is the unique index *and* `scripts/seed.mjs`'s
upsert key. An admin editing a domain would make the next seed run insert a duplicate client, which is
why the update function has no parameter for it.

Business-rule failures raise `45001`, so the route switches on `error.code` and never parses message
text. The last-admin rule lives in `admin_attach_member` and `admin_detach_member`:

```sql
perform pg_advisory_xact_lock(800100);   -- two concurrent demotions of the last two admins
```

Self-demotion is legal provided another admin survives, so there is no special case for "you".
Text bounds (`name` 1–120, a bare host for the domain) belong to zod at the route; `clients.name` has no
length check in DDL and this design does not add one to a shared table. Assigning someone to an
*inactive* client stays legal — that is what a paused tenant looks like to its staff.

## 4. Surface

| Path | Verb | Notes |
| --- | --- | --- |
| `app/admin/page.tsx` | — | server component, dynamic because it awaits the session cookie through `createServerSupabaseClient()`; `requireAdmin()` → redirect to `/dashboard`. §5 verifies that in the build output rather than trusting it. |
| `app/api/admin/clients/route.ts` | `POST` | `{name, domain}` |
| `app/api/admin/clients/[clientId]/route.ts` | `PATCH` | `{name?}` or `{isActive?}` |
| `app/api/admin/members/[userId]/route.ts` | `PUT` / `DELETE` | id in the path, matching `/api/metrics/[clientId]/*` |

Three files, four verbs. Two gates, both required: `PROTECTED_PREFIXES` gains `/admin`
(`lib/auth/routing.ts:22`) so `proxy.ts` bounces anonymous visitors before the page renders, and the
page still calls `requireAdmin()` because a prefix match proves a session exists, not that it is an
admin. Each handler calls `requireAdmin()` as a cheap early exit; the RPC stays the enforcement point.

Entry point: `AccountMenu` already receives `ProfileView`, which carries `role`
(`components/features/user-profile/lib/profile.ts:9`), so the Admin item is one conditional next to
`account-menu.tsx:82` — no change to `/api/dashboard/boot`.

```
components/features/admin/
  index.ts                      barrel → AdminPanel
  components/
    admin-panel.tsx             two stacked regions + mutation state
    client-table.tsx            name · domain · status · members · rename / deactivate
    client-dialog.tsx           one form for create and rename
    member-table.tsx            email · name · role · client · detach
    attach-member-dialog.tsx    directory accounts with no users row yet
  lib/
    provisioning.ts             server-only getAdminView() — mirrors user-profile/lib/profile.ts
    schemas.ts                  zod: clientName, domainHost, memberRole
    mutations.ts                four calls + router.refresh()
```

Stacked, not side-by-side, and it stays that way at `lg`: a member row needs email + role + client and a
client row needs domain + member count, so two columns would only shrink both. Row edits commit on
change — picking a role or client in a `Select` fires the `PUT` under `useTransition`, disables the row,
and toasts on failure; dialogs use `startStatusToast`/`finishStatusToast`.

Deliberately absent: `revalidateTag` (`/api/dashboard/boot` is already `revalidate = 0` and deactivating
a client changes no metric row, so a tag call would invent a coupling); `useOptimistic` (control-plane
writes are one at a time, and a pending row is honest); any new `components/ui/*` — no `form`, `label`,
`switch` or `data-table`, just a bare `<form>` with `<label htmlFor>` per
`email-auth-form.tsx:98` and Active/Inactive as a plain `Button`; server-side rate limiting.

Phone width gets last session's lesson: both tables sit inside `<div className="relative overflow-x-auto">`
— the *positioned* clipper, so `sr-only` descendants cannot escape it — and secondary columns drop below `sm`.

## 5. What must be proven before any of §3 is built

`admin_directory()` assumes the migration role can `select` from `auth.users` from inside a
`security definer` function. Unverified, and the one assumption that could invalidate §3's read side.

Resolve it as a labeled throwaway probe against the **development** project — `scripts/run-migrations.mjs`
plus `SUPABASE_DB_URL` already in `.env`, read-only, no new infrastructure. If it fails, the fallback is
`auth.admin.listUsers()` in the route and §0.2 reverses.

Second thing to verify, cheap and local: that `/admin` actually builds as dynamic and `/dashboard` is
still `○`. The gate is `pnpm build`'s route table, not an assumption about cookies.

## 6. Errors and empty states

Responses follow the existing shape — `{ error: string }`, explicit status, `no-store`, `Vary: Cookie`
(`app/api/metrics/[clientId]/overview/route.ts`).

| `error.code` | Cause | HTTP | Toast |
| --- | --- | --- | --- |
| zod fail | name length, `http://` or a path in the domain | 400 | the specific rule, not "invalid input" |
| `23505` | `clients_domain_key`, case-insensitive collision | 409 | "Another client already owns that domain." Dialog stays open, focus on the field. |
| `45001` | last admin would lose the role | 409 | "Assign another admin before removing this one." |
| `23503` | the client row vanished mid-edit | 409 | "That client no longer exists." |
| `42501` | definer guard — a tab left open past a demotion | 403 | "You no longer have admin access." |
| `23514` | `users_admin_has_no_tenant` — unreachable, since promote nulls `client_id` | 500 | loud; a polite message here would hide a function bug |
| anything else | db unreachable | 502 | "Could not reach the database." |

Only refresh on 2xx: after a refusal the server data is already correct, so `router.refresh()` would
flicker a row the admin just watched decline to change.

Empty states, in the order a real account meets them:
- **The bootstrap state is the normal one** — one admin from the script, no other `public.users` rows,
  Clients full of seed data. So the primary affordance is Attach, and an empty Members table says
  "Accounts that signed up but were never provisioned appear here."
- Provisioned-but-unassigned renders "Unassigned", not an error: a `client` with `client_id = null` is
  legal and logs into the empty shell. Surfacing that is one of the panel's jobs.
- All accounts attached → "Every account is already provisioned."
- Zero clients → Create is the only action; the regions stack rather than collapsing.

No control hides itself based on who you are. Your own row still offers Detach and Postgres answers
`45001` — suppressing the button would copy the last-admin rule into TypeScript. Accepted limitations,
named rather than discovered later: two admins editing one client is last-write-wins (`clients` has no
`updated_at` or version column, and this design does not add one), and a non-admin hitting `/admin` is
redirected rather than shown a 403 page.

## 7. Tests

| Tier | Proves | CI |
| --- | --- | --- |
| `tests/admin/unit/` | auth runs before any db touch; zod rules; the §6 code→status map as a pure function; `getAdminView()`'s directory ∪ provisioned merge | yes, `pnpm test` |
| `tests/admin/integration/` | the guard denies a non-admin; domain uniqueness; promote nulls `client_id`; the last-admin refusal | **never executed** — no `.env.test` exists |
| `tests/identity/e2e/admin-guard.spec.ts`, public | anonymous `/admin` → `/auth/login?next=%2Fadmin` | yes, mirrors `guard.spec.ts:5` |
| `tests/admin/e2e/`, `@auth` | create a client, attach, detach; a logged-in `client` is bounced; no overflow at 320/390 | no — `@auth` is already outside CI |

The guard case goes to `identity`, not `dashboard`: `AGENTS.md`'s folder table assigns
`lib/auth/routing` — the `PROTECTED_PREFIXES` list that actually implements it — to `identity`. The
existing `tests/dashboard/e2e/guard.spec.ts` is on the wrong side of that rule; moving it is out of
scope here, and this spec does not cite it as precedent for the folder, only for the assertion shape.

Extract the §6 mapping into `lib/` as a pure function before writing its test; a table that lives inside
a route handler cannot be unit-tested without a fake `Request` per row.

The integration files land with the whole §3 matrix written out, `describe.skipIf(!hasTestDb)`, and a
header comment saying they have never run. `tests/fixtures/README.md:29` prescribes three fixture users;
step 12 adds a fourth row — `admin@`, `users.role = 'admin'`, `client_id = null` — so update that table
in the same change. Per `README.md:41`, inserts go through the service-role client and every assertion
through the user-scoped one.

The `@auth` tier needs an admin account, and the design already produces one: the `--admin` flag from §8
is both the bootstrap and the fixture. Add `NEXT_PUBLIC_ADMIN_EMAIL`/`_PASSWORD` and widen
`logIn()` (`tests/helpers/log-in.ts:4`, which today can only sign in as the client demo user) to take a
role.

TDD order, since every one of these is behavior: the §5 probe → failing unit test for the error map →
the migration → route tests → the page.

## 8. Bootstrap: how an admin exists

`scripts/create-demo-user.mjs` reads its email from `NEXT_PUBLIC_DEMO_EMAIL` today
(`:11`), so `--admin` switches the source to `NEXT_PUBLIC_ADMIN_EMAIL` rather than inventing a
positional argument. That keeps one env pair serving both purposes: the operator's bootstrap and §7's
`@auth` fixture. `role` stays only in the `users` row, where `AGENTS.md` says it must live — not in a
migration every environment replays, and not derived from an env var at session time.

```
NEXT_PUBLIC_ADMIN_EMAIL=you@example.com node scripts/create-demo-user.mjs --admin
→ auth.admin.createUser + users { role: 'admin', client_id: null }
```

Guard against the footgun the script already has: `:44` lists up to 1000 auth users to find a match, so
it must refuse to run `--admin` if the address is absent *and* the list was truncated, instead of
silently creating a second admin.

## 9. Docs and the gate

- `context/feature-specs/07-admin.md` — required before implementation by
  `docs/conventions/feature-components.md`.
- `context/progress-tracker.md` — an In Progress entry, and the open item that the integration tier is
  written-but-unexecuted until a `.env.test` exists.
- `AGENTS.md` — move admin from `docs/target-state.md` to the implemented surface: the HTTP table gains
  three routes, the Queue/cron section is untouched, and the tenant-isolation paragraph gains one line
  that admin writes go through definer RPCs rather than table grants.
- `docs/target-state.md:327` — step 12 becomes the only line this change is allowed to check off.

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # /admin dynamic, /dashboard still ○
pnpm test:integration   # exit 0, but the run reports N files skipped and 0 passed — quote that
                        # line in the tracker; `--passWithNoTests` makes silence indistinguishable
```

Nothing here is committed; it stays in the working tree for review.

## 10. Open questions this spec does not settle

1. Does an admin need to *rename* a client at all, or is deactivate-and-create good enough? The rename
   path is half of `admin_update_client`'s reason to exist.
2. `member-table.tsx` shows every account to every admin. Is a member's email considered sensitive
   enough to want a per-column rationale later, or is admin-of-all the model you actually want?
3. When the worker-hosting decision lands, does `sync_logs` get its admin view in this same page (a
   third region) or its own route? It affects nothing today and would be cheaper to decide than to
   migrate.
