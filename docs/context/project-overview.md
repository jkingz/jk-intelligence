# Project Overview

### Status

**Built** — Supabase Auth (Google + email/password) with the RLS-backed tenant gate; a multi-client
dashboard (metric cards, trends, keyword rank chart, query table, date ranges) booting from one
`GET /api/dashboard/boot`; CSV/PDF export behind a sliding-window quota; a read-only `/connections`
status page; an admin provisioning panel at `/admin` with three `/api/admin/*` write routes; and the
`app/(app)/` shell whose destination rail lists **two** rows — Dashboard and Connections
(`lib/navigation/destinations.ts`).

**Not built** — real sync (`lib/queue/worker.ts` returns `mock_completed`; dashboard rows come from
`scripts/seed.mjs` and the `api_credentials` rows `/connections` renders from
`scripts/seed-connections.mjs`), any LLM integration (no `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY`, no
Claude call in the repo — and the "AI" surfaces are presentation only: `autonomous-brief.tsx` phrases
numbers it is handed, and `lib/dashboard/overview.ts` hardcodes `aiCitations: []`, so the citation grid
always renders its empty state), and a consumer for the `seo-sync` queue in production.

Verified: 2026-10-13, against the repo at the commit this section was ported into.

State of record for completed work: `docs/progress-tracker.md`.

### Overview

Multi-client automated SEO reporting platform. Clients and internal staff log in to view marketing and SEO performance data pulled daily from GSC, GA4, and SEO APIs. AI generates plain-English performance summaries. Admins manage clients, credentials, and sync jobs from a central admin panel.

### Product boundary — hold (decided 2026-10-15)

**This platform is the product of record, and no new feature unit starts while there is no client
asking for one.** The vertical question that was open between it and agency paid-ads monitoring is
settled by holding, not by choosing a build.

`docs/superpowers/specs/2026-09-24-paid-ads-monitoring-reshape-design.md` (dated record, kept as
written) is **parked, not adopted**. It needs three things the app does not have: a host for
`lib/queue/worker.ts`, a Google Ads developer token, and Meta Marketing API app review. Its slices 0-7
do not enter the build sequence under `docs/target-state/README.md` § Build sequence, and slice 4's
plan to reverse the Slack exclusion in § Project Overview → Scope is void while the hold is in force.

The hold lifts on a trigger, in calendar-risk order: a paying client's concrete request; then the
worker host; then the two platform approvals, which are filed by the owner and are not engineering
work. Building schema ahead of a trigger is what §12's slice-0 warning says has no product value alone.

**Scope of the hold: product features only.** These stay live because they are exposures on the
running hosted database, not new scope — applying `20261010000000_credential_reference_unselectable.sql`
hosted, and the `pg_default_acl` decision that lets the next `public` table arrive closed. Both remain
in § Open product questions.

### Goals

1. Authenticated multi-client access with strict data isolation.
2. Automated daily data syncing from GSC, GA4, Semrush/Ahrefs.
3. Historical metric storage and trend visualization.
4. AI-generated performance commentary per client.
5. Admin panel to add/manage clients and API credentials.
6. Resilient sync: API failure does not break dashboard.

### Core User Flow

1. User signs in (Google OAuth).
2. Client routed to own dashboard; admin routed to client list.
3. Dashboard loads from cache (current_metrics); stale banner shown if > 24hrs.
4. User views organic traffic, conversions, rankings, keyword movements.
5. User selects date range for historical comparison.
6. AI insight widget shows auto-generated summary of performance.
7. Admin adds new client → sets API credentials → activates daily sync.
8. Daily cron job syncs all clients → stores snapshots → updates cache.
9. User downloads CSV/PDF export of metrics.

Steps that do not execute today: 6 (no AI insight exists), 7's credential-and-activation half
(`api_credentials` is read-only; the panel writes clients and members only), and 8 (the cron
enqueues; nothing consumes it). Step 3 reads seeded rows.

### Scope

#### In Scope

- Google OAuth + route protection
- Multi-client data isolation (Supabase RLS)
- Admin panel: client + credential management
- GSC, GA4, Semrush/Ahrefs API integrations
- Automated daily sync with error handling + retry
- Historical metric storage (immutable snapshots)
- Denormalized current_metrics cache (fast dashboard loads)
- Stale-data detection + warning UI
- Keyword rankings time-series
- AI-generated performance summaries (Claude API)
- CSV + PDF export
- Sync audit logs

#### Out of Scope

- Billing and subscriptions
- White-label branding per client (Phase 3+)
- Competitor benchmarking (Phase 2+)
- Technical SEO health crawl (Phase 2+)
- Versioned spec history
- Mobile-native app (responsive web only)
- Slack/Zapier integrations
- Agency paid-ads monitoring (Google Ads + Meta) — parked behind external gates, not designed away;
  see § Product boundary — hold

### Success Criteria

1. Client logs in, sees only their own data.
2. Daily sync runs without manual intervention.
3. Dashboard renders cached data even if all APIs are down.
4. Admin can add new client and activate sync in < 5 mins.
5. AI insight summary generated and displayed per client.
6. Historical trend visible across any custom date range.
7. CSV/PDF export works for any date range.
8. Sync failures logged, admin alerted, no dashboard crash.

### Open product questions

Compressed 2026-10-13 from the log's four live sections; the dated evidence behind each line stays in
`docs/progress-tracker.md`. Questions only — a line about what is not built belongs in the next section, § Project
Overview → Status, not here.

- **Who hosts the `seo-sync` worker** — an always-on process (Fly/Render), the cron calling sync
  inline, or QStash. Every real fetch waits on it, and so does the credential write behind the inert
  Connect button on `/connections`. Re-framed by § Product boundary — hold (2026-10-15): this is no
  longer the next unit's decision to make, it is the second gate the hold names, and nothing is paid
  for a host until a client request lifts the hold.
- **Whether to apply `20261010000000_credential_reference_unselectable.sql` to the hosted project.**
  It has run on the local stack only, so hosted `authenticated` still holds table-wide `select` on
  `api_credentials`; a hosted apply needs the owner's explicit yes, as every hosted migration here has.
- **How to stop the next `public` table arriving already open.** `pg_default_acl` grants
  `authenticated` and `anon` every table privilege on it, so the choice is one
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated` migration
  or a standing rule that each new table's migration revokes and re-grants its own columns.
- **How the `@auth` tier gets an admin account without breaking the integration tier.**
  `tests/admin/integration/provisioning.test.ts` asserts `admins == 1` globally and its attach case
  takes the first row with no `order by`, so the second admin — the `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  pair six `@auth` admin specs still wait on — makes a demotion succeed and the assertion fail, after
  the suite has mutated a row it does not own. Measured 2026-10-06: 2 failed / 17 passed with two
  admins, 19/19 with one. Either scope those two cases to `FIXTURE_USERS.admin`'s id or run `@auth`
  on a stack that never runs the integration tier; the first removes a landmine but edits a shipped,
  currently-green test file, and the second leaves the two tiers untestable on one machine.
- **Whether to stand up a hosted test database.** The integration tier `skipIf`s without
  `TEST_SUPABASE_URL`, so until that decision CI is unit + public e2e only.
- **What is actually configured on the hosted Supabase project** — Google OAuth enabled, the
  `/auth/callback` and `/auth/reset-password` redirect-URL allowlist, PKCE `token_hash` email
  templates. None of it is checkable from the local stack, so end-to-end OAuth and email flows stay
  unverified.
- **Which env vars are mirrored into Vercel production** — `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the Upstash pair, and the server-only
  `DEMO_EMAIL`/`DEMO_PASSWORD`. Where they are missing, the cron, the worker and the demo card simply
  do nothing.

