# 01 Overview And Architecture

## Goal
Build a GitHub-connected docs agent that listens for pull request events, evaluates whether the changes require documentation updates, and when they do generates Fumadocs edits and opens a draft PR with the proposed docs changes.

## Success Criteria
- A qualifying GitHub `pull_request` webhook reaches the server.
- The system can inspect the source PR and decide whether docs are needed.
- If docs are needed, the system produces changes only under `apps/fumadocs/content/docs`.
- The system creates or updates a draft PR containing those docs changes.
- The workflow is testable in slices without requiring a full end-to-end live run for every change.

## Why This Repo Shape Fits
- Reuse `apps/server` because it already hosts Hono routes, central server env validation, and AI SDK usage.
- Reuse `apps/fumadocs` because it is already the repo's documentation surface and stores docs as MDX files under `content/docs`.
- Add a new shared package because GitHub webhook parsing, PR analysis, AI prompting, and PR creation logic should remain separate from HTTP route code.

## Proposed Boundaries
### `apps/server`
- Hosts `POST /webhooks/github`.
- Verifies webhook authenticity.
- Converts incoming events into a normalized internal shape.
- Calls the shared workflow package.
- Exposes a minimal health or debug route if needed for local replay.

### `packages/github-doc-agent`
- Owns the business logic for the docs agent.
- Contains modules for webhook normalization, GitHub client creation, PR scanning, classification, doc generation, and PR writeback.
- Holds fixtures and tests for the workflow.

### `apps/fumadocs`
- Remains the only destination for generated docs changes in v1.
- Continues to own docs rendering and MDX structure.
- May need a small metadata cleanup so GitHub links point to the real repo.

## End-To-End Workflow
1. GitHub sends a `pull_request` webhook to `apps/server`.
2. The server verifies the signature and filters to supported actions.
3. The server normalizes the payload and passes it to `packages/github-doc-agent`.
4. The agent fetches PR metadata, changed files, and selected diff context from GitHub.
5. Deterministic heuristics decide whether the PR is even worth AI evaluation.
6. If relevant, an AI classifier returns a structured decision about whether docs updates are needed.
7. If docs are needed, a doc-generation step prepares MDX updates only inside `apps/fumadocs/content/docs`.
8. The agent creates or updates a bot branch, commits the docs changes, and opens or refreshes a draft PR.
9. Logs capture the event id, source PR number, decision, and docs PR result.

## V1 Constraints
- Fumadocs-only write scope.
- Draft PR only, no auto-merge.
- No DB persistence.
- No multi-repo orchestration.
- No non-doc file changes.
- No requirement to comment on the source PR unless later added as an enhancement.

## Initial Non-Goals
- Editing product code or tests.
- Updating arbitrary markdown across the repo.
- Cross-repository doc synchronization.
- A reviewer UI in `apps/web`.
- Background job infrastructure beyond the request-driven flow.
