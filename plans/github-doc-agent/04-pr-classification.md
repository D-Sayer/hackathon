# 04 PR Classification

## Objective
Implement the second delivery slice: inspect the source PR, gather enough context to evaluate doc impact, and decide whether documentation updates are required.

## Inputs
- Normalized webhook event from the intake step
- PR metadata from GitHub
- Changed file list from GitHub
- Selected patch or diff context for files likely to affect docs
- PR title, body, and labels when present

## Deterministic Heuristics First
Use low-cost rules before invoking an LLM.

Positive indicators:
- Changes under `apps/server`
- Changes under `apps/web`
- Changes under `packages/*`
- PR title or body mentions feature changes, API changes, UX changes, setup changes, or breaking behavior

Negative indicators:
- Docs-only changes
- Internal refactors with no external behavior change
- Test-only or CI-only changes
- Formatting-only changes

If deterministic heuristics clearly say "no docs impact", skip the model.

## LLM Classification
Use AI SDK with a structured output contract. The model should receive:
- PR title and body
- filtered changed file list
- selected diff snippets
- instructions about what counts as docs-worthy changes in this repo
- current docs scope limited to Fumadocs

Required response shape:
- `needsDocs: boolean`
- `rationale: string`
- `targetPages: string[]`
- `proposedChanges: string[]`

The classifier should explain why docs are needed or not needed in a way that can be logged and later surfaced to operators.

## Decision Rules
- `needsDocs=false` if the PR has no user-facing, developer-facing, setup, or API behavior change.
- `needsDocs=true` if the PR changes behavior, workflow, surface area, configuration, or concepts a user or integrator needs to understand.
- Prefer a conservative bias toward opening a docs draft PR when impact is real but page targeting is imperfect.

## Test Fixtures And Cases
Create fixture-based tests for:
- a new feature in `apps/web` that should trigger docs
- an API surface change in `apps/server` or `packages/api` that should trigger docs
- an internal refactor that should not trigger docs
- a docs-only PR that should not trigger a docs PR
- a config/setup change that should trigger docs

## Done Criteria
- The classifier can fetch and evaluate source PR context.
- Deterministic heuristics reduce unnecessary LLM calls.
- Structured output is validated with types or schemas.
- Representative fixtures prove both positive and negative classifications.
