# App Shell and Destination Rail

## Goal
One persistent chrome around every authenticated page: a collapsible icon rail on `md+`, an
off-canvas drawer opened from a hamburger bar below it, and the account block in the rail's
footer — so `/dashboard`, `/connections`, `/profile` and `/admin` share identity, navigation and
sign-out instead of each re-declaring a header.

## Invariants
- The shell is a server component and reads no session, no cookies, no data. `/dashboard`
  must stay prerendered (`○`); a session read in the shell re-introduces the 4-5s Vercel
  switch the client-side boot fetch was built to fix.
- That invariant is why the account block exists in its current shape: `NavUser` fetches its own
  identity from `GET /api/auth/me` client-side after hydration. Nothing in `app/(app)/layout.tsx`
  or `components/features/app-shell/*` may await a session, read a cookie, or call
  `getAuthSession()`/`getProfileView()` on the server. `/api/auth/me` is the only door.
- Collapse state lives in `localStorage` (`app-shell:sidebar-open`), read through
  `useSyncExternalStore` with `getServerSnapshot() === true`. The primitive's own cookie
  persistence is deliberately unused — the server would have to read it back, which is the
  forbidden edit. `getServerSnapshot` matching the prerendered shell is what keeps hydration from
  warning about a mismatch.
- `lib/navigation/destinations.ts` is the only rail list. Every href it renders must be in
  `PROTECTED_PREFIXES`; `tests/platform/unit/destinations.test.ts` asserts the parity, so a
  destination cannot be advertised before it is guarded.
- Below the rail breakpoint the drawer is a modal over the *next* page, not a companion to the
  current one: every destination link closes it, and so does every account action.
- Route group `app/(app)/` never appears in a URL. `/dashboard`, `/profile`, `/connections`
  keep their paths.

## Sizing
`--sidebar-width` is overridden to 15rem because the primitive defaults to 16rem, which is wider
than the `w-60` rail `ui-context.md` documents. The icon rail keeps the primitive's 3rem. The
drawer uses the primitive's own 18rem. Breakpoint is the primitive's 768px (`useIsMobile`), so
`MobileNav` is `md:hidden` and the rail's header trigger is `hidden md:flex`.

## Non-goals
- Role-gated destinations. A `visibleDestinations(role)` filter still has zero callers: the rail
  renders two destinations for everyone. `/admin` is not one of them —
  `activeDestination("/admin")` returns `null`, so the rail renders beside it with **no row marked
  active**. That is a state, not an oversight, and marking the Dashboard row active on an admin
  page would be a lie the rail tells on purpose. `/profile` is in the same state since its rail row
  was deleted: the account block *is* the profile entry, and a second link to the same place made
  the list say two things about one destination. The role now *is* known in the shell — the
  account block reads it from `/api/auth/me` and shows an Admin item — but filtering the
  destination list would push that knowledge into server-rendered chrome, which is the edit this
  file forbids.
- Moving the client selector into the shell. It is dashboard scope, and the dashboard's
  `EmptyShell` states have no client to select.
- Any change to what `?client` / `?days` / `?tab=` mean or to the `<Activity>` tab panels. The
  *write mechanism* did change (see Limitations); the contract did not.

## Accepted limitations
- A user who left the rail collapsed sees it expanded for one frame on a full page load. The
  shell is prerendered expanded, and the preference is replayed after hydration. Flipping the
  first paint would require reading something server-side.
- The account block renders a skeleton row until `/api/auth/me` answers, and renders nothing when
  there is no profile. A spec that clicks the row before the data lands clicks a skeleton with no
  menu attached — `tests/helpers/open-account-menu.ts` waits for `aria-haspopup="menu"` for
  exactly that reason.
- On phones the Profile item navigates to `/profile` instead of opening `ProfileDialog`. Closing
  the drawer unmounts the subtree that owns the dialog, so a dialog opened from inside it vanishes
  with the drawer.
- One nav landmark named "Sections" per width, because the strip is gone. Specs still take
  `.first()` or scope to the drawer rather than asserting exactly one exists.

## Verification
`pnpm build` route table (`/dashboard` `○`, `/api/auth/me` `ƒ`),
`tests/platform/unit/destinations.test.ts`, `tests/identity/unit/me-route.test.ts`,
`tests/identity/e2e/connections-guard.spec.ts`, `tests/identity/e2e/nav-user.spec.ts`,
`tests/dashboard/e2e/rail.spec.ts` (collapse, persist across reload, drawer navigation, and no
page overflow at 320/390/414).
