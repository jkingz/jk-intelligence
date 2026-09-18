Read `AGENTS.md` before starting.

We're adding the user profile feature: view account identity and sign out.

## Scope
- `/profile` page (protected — proxy already gates all non-`/auth` routes)
- Shows: email, role (admin|client), linked client (when role=client), account provider identities
- Sign out button (server action → `supabase.auth.signOut()` → redirect `/auth/login`)
- Dashboard header avatar opens an accessible account menu: Profile link and Log out action.
- Avatar uses authenticated email initial, falling back to a user icon; no identity metadata used for authorization.
- Page composes the profile-owned menu into a dashboard slot; no cross-feature imports.
- Logout disables repeat submission and shows a generic failure message without redirecting on failure.

## UI
- New folder per convention: `components/features/user-profile/`
  - `components/profile-card.tsx` (server-rendered info), `components/sign-out-button.tsx` ("use client")
  - barrel `index.ts` exports `ProfileCard`, `SignOutButton`, `getProfileView()`
- New `app/profile/page.tsx` — thin: `getProfileView()` → render; unauthenticated handled by proxy
- Reuse Card/Button/Input tokens; dark theme; layout patterns from `ui-context.md`

## Implementation
- Data: `auth.getUser()` (email) + `users` row via existing `getAuthUser()` (role, client_id); NO new DB tables, RLS unchanged
- Editable details: display name stored in Supabase Auth `user_metadata.name` via `auth.updateUser({ data })` in feature server action; Zod-validated (trimmed, ≤80 chars), generic errors
- Sign out: server action in feature `lib/`, `createServerSupabaseClient().auth.signOut()`
- Role/client assignment stays admin-provisioned — not editable by users

## Security
- Profile page renders only caller's own data (RLS + getAuthUser)
- Sign-out clears session cookies server-side; no CSRF-sensitive state change beyond auth

## Check when done
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- Unauthenticated `/profile` → redirected to login by proxy
- Sign out → session cleared, login reachable again
