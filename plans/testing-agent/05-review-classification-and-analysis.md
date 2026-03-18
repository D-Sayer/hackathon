# 05 Review Classification And Analysis

## Objective
Implement the analysis slice: inspect the source PR and attached issue, apply low-cost heuristics first, and then use an LLM to return a structured review summary with implementation gaps, testing notes, blast radius, and likely oversights.

## Inputs
- Normalized webhook event
- PR title and body
- Attached issue title and body when present
- Changed file list from GitHub
- Selected diff snippets for relevant files

## Deterministic Heuristics First
Use low-cost rules before invoking an LLM.

Positive indicators:
- Changes under `apps/server`
- Changes under `apps/web`
- Changes under `packages/*`
- PR title or body mentions feature changes, bug fixes, behavior changes, migrations, workflow changes, or config changes

Negative indicators:
- Docs-only changes
- Internal refactors with no external behavior change
- Test-only or CI-only changes
- Formatting-only changes
- Missing attached issue in v1

If deterministic heuristics clearly say there is nothing useful to write back, skip the model.

## LLM Review Analysis
Use AI SDK with a structured output contract. The model should receive:
- PR title and body
- attached issue title and body when present
- filtered changed file list
- selected diff snippets
- instructions about identifying implementation completeness, test coverage gaps, blast radius, and oversights in this repo

Required response shape:
- `shouldComment: boolean`
- `summary: string`
- `implementationGaps: string[]`
- `testingNotes: string[]`
- `blastRadius: string[]`
- `oversights: string[]`
- `confidence: "low" | "medium" | "high"`
- `rationale: string`

## Decision Rules
- `shouldComment=false` when no attached issue is found in v1.
- `shouldComment=false` when the PR is clearly docs-only, formatting-only, or internal-only with no meaningful review feedback.
- `shouldComment=true` when there is actionable feedback to capture for the attached issue.
- Prefer concise, actionable findings over speculative commentary.

## Prompt Guidance
- Compare the PR intent to the attached issue intent.
- Call out mismatches between issue scope and actual implementation.
- Identify missing or weak tests, especially around failure paths, permissions, migrations, and user-facing flows.
- Highlight the likely blast radius based on touched surfaces, shared packages, and config changes.
- Avoid generic praise or non-actionable commentary.

## Test Fixtures And Cases
Create fixture-based tests for:
- a feature PR with an attached issue that should produce gaps and testing notes
- a bug fix PR where the issue is only partially addressed
- an internal refactor that should skip comment generation
- a docs-only PR that should skip comment generation
- a setup or config change that should call out blast radius and validation notes
- a PR with no attached issue that should skip model execution

## Done Criteria
- The classifier can evaluate combined PR and issue context.
- Deterministic heuristics reduce unnecessary LLM calls.
- Structured output is validated with types or schemas.
- Representative fixtures prove both positive and negative analysis paths.
