# Feature Component Conventions

## PR Conventions

- Branch: `feat/<slug>` — e.g. `feat/email-password-auth`
- Title: `feat(<slug>): <what>` — e.g. `feat(auth): email + password sign-in/sign-up`
- One feature unit per PR; spec must exist in `specs/` before implementation
- PR body links the spec path and names the verification the unit passed; the `docs/progress-tracker.md` record is written after that, under `## Completed`, so there is no tracker note to link at PR time
- Checks green before ready: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`

## Feature Folders

Every feature gets its own folder in `components/features/<slug>/`. Number prefixes belong only to `specs/<nn>-<slug>.md`; use unnumbered folders, imports, branches, and PR scopes.

```
components/features/<slug>/
├── index.ts            # public exports only — the single import surface
│
├── components/         # presentational components (no data fetching)
│   └── <component>.tsx
├── hooks/              # use<X> hooks (state, polling, derived data)
└── lib/                # pure helpers/types for this feature
```

Nothing test-shaped goes in the feature folder. Tests live in `tests/<feature>/<tier>/`
(`unit` / `integration` / `e2e`), named after the invariant they protect — see
`docs/architecture/README.md` § Verification for the folder list and what each folder owns, and
`docs/conventions/project-rules.md` § PROJECT RULES 13 for the placement rule. A feature slug used as a test folder name must
already exist there; if it does not, the feature owns no test folder yet and the test belongs under the
domain that owns the invariant.

## Wiring Rules

- App pages import ONLY from the feature `index.ts` barrel — never deep-import internals:
  `import { EmailAuthForm } from "@/components/features/email-password-auth"`
- Feature code may import: `components/ui/*`, own feature folder, `lib/*`, `types/*`
- Cross-feature imports forbidden — shared logic moves down to `lib/` or up to `components/ui`
- `components/ui/*` stays untouched (protected foundation)
- Server components by default; `"use client"` only inside feature components that need interactivity
- Feature owns its spec and log update (`docs/progress-tracker.md` + the feature's spec)

## Checklist (new feature)

1. Spec in `specs/<nn>-<slug>.md`
2. No tracker entry yet — `## In Progress` is history, not a status board; the record lands at step 6
3. Folder `components/features/<slug>/` with barrel
4. Implement components/hooks/lib in folder; tests in `tests/<feature>/<tier>/`, not here
5. Wire via barrel in `app/` pages/routes
6. Checks green, then record the unit under `docs/progress-tracker.md`'s `## Completed` — never as status in the four history sections
