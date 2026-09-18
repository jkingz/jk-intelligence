# 02 — Email + Password Sign-In / Sign-Up

## Goal
Add email/password auth alongside Google OAuth, matching the existing auth scaffolding.

## Scope
- Sign-up: email + password, email confirmation flow
- Sign-in: email + password, `next` redirect after login
- Forgot/reset password: request reset email + update password form

## UI
- Extend `app/auth/login/page.tsx` with tabs: Google OAuth | Email/Password
- New `app/auth/sign-up/page.tsx`
- New `app/auth/forgot-password/page.tsx` + reset form
- Reuse existing Card/Input/Button/Tabs components; dark theme
- Error banners same pattern as login (sanitized messages)

## Implementation
- Supabase Auth: `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`
- Email confirm callback handled by existing `app/auth/callback/route.ts` (PKCE)
- Redirect after auth: existing sanitized `next` logic in `lib/auth/routing.ts`
- No new DB tables; auth.users only. RLS unchanged.

## Security
- Password min 8 chars, client-side validation
- Generic error messages (no user enumeration)
- Reset emails must redirect to sanitized `/auth/reset-password` route only

## Check when done
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- Sign-up → confirm email → sign-in works (or unit-tested if no live Supabase)
- Unauthenticated users cannot reach dashboard
