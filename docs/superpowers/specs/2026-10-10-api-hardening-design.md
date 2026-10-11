# API hardening: cache posture, one gate, one column privilege

Date: 2026-10-10
Status: approved in chat (Repo-only hardening); CAPTCHA and Supabase audit-log config explicitly out
Branches: three, each off `main`, each its own PR — `pm-conventions.md` forbids a grab-bag PR.

## Why this exists

A gap review on 2026-10-10 turned up three things that looked like vulnerabilities. Two of them
are not, and one is real but not for the reason recorded in the docs. The review ran against the
code and against official platform docs; the results below are what this change is built on.

**Checked and cleared — no work here.**

- *CSRF on the admin writes.* `@supabase/ssr` sets the session cookie `sameSite: "lax"`
  (`node_modules/@supabase/ssr/dist/main/utils/constants.js:6`), so a cross-origin
  POST/PATCH/DELETE arrives with no cookie and `requireAdmin()` answers 401.
- *`credential_reference` holds no key material.* It is an opaque pointer enforced by
  `check (credential_reference ~ '^vault:[0-9a-fA-F-]{36}$')`
  (`supabase/migrations/20260917000000_seo_poc.sql:38-39`) and `context/architecture-context.md:63`
  states no secret lives in Postgres. Its tenant-readability is defence-in-depth, not a leak (unit 3).
- *Env hygiene.* No `NEXT_PUBLIC_*` name in `app/`, `lib/`, `components/`, `scripts/` carries a
  secret; the only four are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, the legacy `ANON_KEY`
  fallback and `APP_URL`. No `console.*` in `app/` or `lib/`.
- *Cron bearer check.* `lib/auth/cron.ts:15` compares with `timingSafeEqual` and fails closed
  when the secret is absent.
- *Server-side auth rate limiting in our own layer.* Not available: sign-in, sign-up and reset are
  called browser → Supabase Auth (`components/features/email-password-auth/lib/email-password.ts:36-64`),
  so our server never sees the request. Supabase's own buckets cover it (per-IP 150/5 min on
  `/auth/v1/token`, 30/5 min on `/signup` and `/recover`). Proxying auth would move those buckets
  onto our server's IP and is not the documented pattern — the CAPTCHA route is the fix for the
  remaining gap (no per-account lockout exists in GoTrue), and King chose not to take it today.

**Real, and the reason for unit 1.**

Both metrics routes answer the tenant-gated payload with
`Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
(`app/api/metrics/[clientId]/overview/route.ts:75`, `.../keywords/route.ts:96`), plus
`Vary: Cookie`. `context/architecture-context.md:98` records that as a three-way bound — CDN ==
client `CACHE_TTL_MS` == `unstable_cache revalidate`, 300 s each — and two unit tests pin the
header string.

Per Vercel's own docs that bound has never existed. Vary "combines the cache key with the values
of any request headers specified in Vary", and cookie is a denied high-cardinality header:
"Vercel's CDN doesn't cache a response whose `Vary` names… `Cookie`" — the CDN returns
`x-vercel-cache: MISS` with reason `vary_key_denied:cookie`
([cdn-cache](https://vercel.com/docs/caching/cdn-cache),
[cache-status](https://vercel.com/docs/caching/cache-status), changed
[2026-09-30](https://vercel.com/changelog/vary-cookie-responses-no-longer-cached)). The cache key
is method, URL, host and scheme, and "cache keys are not configurable"
([purge](https://vercel.com/docs/caching/cdn-cache/purge)).

So today the request always reaches the function, the RLS gate always runs, and no tenant's
payload can reach another tenant. The exposure is the opposite of a leak: **tenant isolation
currently depends on a header chosen for caching reasons, and nothing in the repo says so.** If
`Vary` is dropped from those responses — a future edit, or a `next.config.ts` / `vercel.json`
header rule that overwrites it — `public, s-maxage=300` becomes a URL-keyed edge cache holding
per-tenant data, and the gate is skipped on the hit. Vercel documents exactly that as the reason
for the rule: "serving a stored copy to a different visitor would return one visitor's content to
another."

## Unit 1 — make the cache posture intentional

Files: the two metrics routes, their two route unit tests, `context/architecture-context.md`,
`context/code-standards.md`, `context/progress-tracker.md`, `AGENTS.md`.

- The 200 path on both routes becomes `Cache-Control: no-store` + `Vary: Cookie` — the same shape
  every other authenticated route already uses (`/api/auth/me`, `/api/dashboard/boot`, both
  exports, all three admin routes). No `public`, no `s-maxage`, no `stale-while-revalidate`.
- The freshness bound that survives is the one that was real: `unstable_cache revalidate: 300` ==
  client `CACHE_TTL_MS` == 300. The invariant text changes from three-way to two-way and names the
  reason the CDN leg is gone, with the doc citation.
- Tests: both files keep their header assertion but assert the new string, and each gains one
  negative assertion — the response must not advertise shared-cache freshness. That is the
  security property, and it has to be pinned, not implied.
- Cost: none measurable. The CDN never stored these responses, so removing the header removes a
  no-op. `unstable_cache` and the dashboard's in-memory range cache keep working.

## Unit 2 — `lib/api/guard.ts`: one gate, one response shape

Files: new `lib/api/guard.ts`; the 9 session-gated routes (of 11 — the two bearer-secret ones are the exception below); `lib/admin/http.ts` deleted and its four helpers moved; `tests/platform/unit/guard.test.ts`; the route tests that assert status codes.

Eleven route handlers exist and `proxy.ts` bypasses `/api` entirely, so every one of them is its
own enforcement point. Today there are two styles: the admin trio goes through
`lib/admin/http.ts` (a comment there says "Four handlers repeating fifteen header lines is how one
of them drifts"), and the metrics pair hand-rolls the same five-line header object four or five
times per file.

Shape — gates return either the thing the route needs or a finished `Response`, and control flow
stays in the route:

```ts
// lib/api/guard.ts
export const NO_STORE: Headers;             // Content-Type + no-store + Vary: Cookie
export function json(body: unknown, status: number): Response;
export function badRequest(message: string): Response;
export function readJsonBody(request): Promise<{ ok: true; value: unknown } | { ok: false; message: string }>;
export function firstIssueMessage(error: z.ZodError): string;

export type Gate<T> = { allow: true; value: T } | { allow: false; response: Response };
export async function gateSession(): Promise<Gate<AuthUser>>;              // 401 / 503
export async function gateAdmin(): Promise<Gate<AuthUser>>;                // 401 / 403 / 503
export async function gateClientAccess(clientId: string): Promise<Gate<true>>;   // canAccessClient
export async function resolveAccessibleClient(clientId: string): Promise<Gate<DashboardClient>>; // listAccessibleClients
```

Rules this unit holds to:

- `lib/api/guard.ts` implements **no** ownership rule. `gateClientAccess` and
  `resolveAccessibleClient` are thin calls onto `canAccessClient` / `listAccessibleClients`, which
  is where RLS decides (`RULES.md` §15, `AGENTS.md` → Tenant isolation). `authAgent` keeps its
  role answer and does not grow a copy of the client rule.
- The 503 path stays: an identity or gate read that *throws* must not become a 401. Both are
  covered by existing tests, which is the check that this refactor changed no decision.
- Out of scope, deliberately: `/api/cron/sync` and `/api/revalidate/dashboard` authenticate with
  the `CRON_SECRET` bearer, not a session. They keep `verifyCronSecret` and their own bodies;
  folding them into a session guard would be a false abstraction. `/api/exports/*` streams — it
  keeps its own response construction and reuses only the header constant.
- `lib/admin/http.ts` is deleted, not kept as a re-export. Its three callers import from
  `@/lib/api/guard` instead. A compatibility shim would be the second source of truth.

Verification: the four gates plus `pnpm test:all` with the local stack. The route tests are the
safety net — every existing 401/403/400/503 assertion must pass unchanged against the new code,
which is what makes this a refactor rather than a rewrite.

## Unit 3 — revoke the `credential_reference` column

Files: new `supabase/migrations/20261010000000_credential_reference_unselectable.sql`;
`tests/tenant-isolation/integration/credentials-visibility.test.ts`;
`supabase/migrations/20260925000000_connections_read.sql` gains no edit (applied migrations are
never rewritten — `RULES.md` §16), but its "Deliberate: … acceptable because" comment is
superseded, so `context/feature-specs/09-connections.md`, `AGENTS.md` and `docs/target-state.md`
carry the change instead.

- `revoke select (credential_reference) on public.api_credentials from authenticated` — the only
  authenticated-facing grant is the table-wide `grant select` at
  `20260925000000_connections_read.sql:21`.
- The integration file gains one case: through a real tenant session, selecting
  `client_id,source,created_at` still succeeds and selecting `credential_reference` fails. That is
  the difference between a policy that reads right and a policy that Postgres enforces.
- **Unverified, and the first step of the unit is verifying it:** column-level `REVOKE` against an
  earlier table-level `GRANT` is the form expected to work in Postgres; it has not been run here.
  If Postgres rejects it, the fallback is a `private` view exposing the three status columns and
  re-granting through that, or leaving the column as-is with the reason recorded. No claim of
  success before `pnpm test:integration` prints the counts.
- Applying it goes to the **local** stack only, and `.env` here points at hosted production, so
  the run sets `SUPABASE_DB_URL` to the local database explicitly (`RULES.md` §16). Hosted apply
  needs its own yes, as every hosted migration in this repo's history has.
- Forward constraint, so the sync worker does not undo this: the worker resolves a credential
  reference through a service-role read or a `security definer` function, never through a
  tenant-visible select. Recorded in `docs/target-state.md`.

## What this pass does not touch

The sync pipeline, the worker-hosting decision (Open Questions 1 and 2), real credential writes,
`is_stale`'s missing writer, `aiCitations`, observability, generated `types/database.ts`, and the
six `@auth` admin specs blocked by Open Question 11. The `databaseOperation()` error wrapper that
swallows its cause stays open for the same reason it was left before: eight test files assert its
message.

## Order

1 → 2 → 3. Unit 1 collapses every authenticated route onto one header set, which is what lets unit
2 hold one constant instead of two. Unit 3 is independent but slowest to verify (it needs Docker
and a live Postgres), and its migration is the only artifact here that can reach a hosted database.
