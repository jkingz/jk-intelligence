# `<NN>` — `<feature name>`

> One unit of deliverable work. This is the spec the implementer reads, so anything stated
> here is a requirement, not an idea. Behavior you inferred rather than were told belongs in
> **Deferred** with a question mark.

## Goal
`<what the user can do when this is finished, in one sentence, phrased as an observable>`

## First increment
The smallest slice that runs and can be verified alone:
1. `<step>`
2. `<step>`

## Later increments
Name each one; leave the detail until it is next.
- `<increment>`

## Deferred / open questions
- `<what the owner has not answered>`
- `<what was cut, and why>`

## Security / permissions
`<who may do this, how that is enforced, and which single authority decides it — then the
test that proves a foreign request is refused>`

## Verification
- `<gate command>` → `<expected output>`
- `<the manual/live check a test cannot make, and how to see it>`
- `<what remains unverified when this ships>`

## Where the two spec homes differ

`specs/` holds numbered feature specs — one deliverable unit each, named in implementation order.
`docs/superpowers/specs/` holds dated design docs from brainstorming. File a design doc there and a
feature spec here; `AGENTS.md § FEATURE SPECS` says so in one line.
