# App Shell and Destination Rail

## Goal
One persistent chrome around every authenticated page: a left destination rail at `lg+`,
a horizontal strip below, so `/dashboard`, `/connections` and future pages share identity
and navigation instead of each re-declaring a header.

## Invariants
- The shell is a server component and reads no session, no cookies, no data. `/dashboard`
  must stay prerendered (`○`); a session read in the shell re-introduces the 4-5s Vercel
  switch the client-side boot fetch was built to fix.
- `lib/navigation/destinations.ts` is the only rail list. Every href it renders must be in
  `PROTECTED_PREFIXES`; `tests/platform/unit/destinations.test.ts` asserts the parity, so a
  destination cannot be advertised before it is guarded.
- Route group `app/(app)/` never appears in a URL. `/dashboard`, `/profile`, `/connections`
  keep their paths.

## Non-goals
- Collapsing/expanding. `ui-context.md` listed "(collapsible)"; dropped, because a
  collapsed-by-default rail makes every destination one click from undiscoverable.
- Role-gated destinations. With no `/admin` route there is no difference to render, and a
  `visibleDestinations(role)` filter would be an abstraction with one hypothetical caller.
  The admin panel adds its row and the filter together.
- Moving the client selector or `AccountMenu` into the shell. Both need the session; the
  selector is dashboard scope today.
- Any change to `?client` / `?days` / `?tab=` URL state or the `<Activity>` tab panels.

## Accepted limitations
- Two nav landmarks share the name "Sections" (rail + strip). They are `lg:hidden` /
  `hidden lg:flex`, so exactly one is in the accessibility tree at any width; e2e takes
  `.first()` rather than asserting one exists.
- Below `lg` the brand mark is not repeated in the strip: `/dashboard`'s footer carries it at every
  width, the login card carries it after a guard redirect, and `/connections` and `/profile` show no
  brand at all below `lg`.

## Verification
`pnpm build` route table (`/dashboard` `○`), `tests/platform/unit/destinations.test.ts`,
`tests/identity/e2e/connections-guard.spec.ts`, `tests/dashboard/e2e/rail.spec.ts`
(`@auth`, incl. no page overflow at 320/390/414).
