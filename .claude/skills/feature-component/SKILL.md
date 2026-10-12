---
name: feature-component
description: Scaffold or migrate feature components using the repo spec-first workflow, unnumbered feature folders, barrel imports, and PR conventions.
---

# Skill: feature-component

Scaffold, structure, and wire a new feature as a self-contained folder under `components/features/`, following repo PR conventions.

## When to use
User asks to "add feature X", "scaffold feature <slug>", "wire up a new feature", or creates a new feature spec.

## Inputs
- Use the requested spec `specs/<nn>-<slug>.md` (or ask). Strip `<nn>-` for feature folders, imports, branches, and PR scopes; numbers belong only to specs.

## Workflow
1. Verify spec exists in `specs/<nn>-<slug>.md`. If not, write it first (goal, scope, UI, implementation, security, checks).
2. Write no tracker entry yet — `## In Progress` in `docs/progress-tracker.md` is history, not a status board; the record is step 8, after verification.
3. Create folder + barrel:
   ```
   components/features/<slug>/
   ├── index.ts        # only public exports
   ├── components/     # presentational, no data fetching
   ├── hooks/          # use<X> hooks
   └── lib/            # pure helpers + types
   ```
   Tests do **not** go in the feature folder: they live in `tests/<feature>/<tier>/`
   (`unit` / `integration` / `e2e`), where `<feature>` is the domain that owns the invariant —
   `identity`, `tenant-isolation`, `dashboard`, `export`, `sync`, `landing`, `platform`. Import the
   subject through `@/`, never a relative path.
4. Implement inside folder. Allowed imports: `components/ui/*`, own folder, `lib/*`, `types/*`. Never `components/ui/*` edits, never cross-feature imports.
5. Wire pages/routes via barrel only: `import { X } from "@/components/features/<slug>"`.
6. PR (when requested): branch `feat/<slug>`, title `feat(<slug>): <what>`, body links the spec path and says which verification the unit passed — there is no tracker note to link at this point, because the log record is step 8's.
7. Verify: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`.
8. Record the unit under `docs/progress-tracker.md`'s `## Completed`; update the feature's spec in `specs/` and any `AGENTS.md` section the change made untrue.

Full rules: `docs/conventions/feature-components.md`

## Notes
- Server components by default; `"use client"` only where interactive.
- Existing features (pre-convention) migrate opportunistically, not proactively.
