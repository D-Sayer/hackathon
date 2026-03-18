# 01 Overview And Architecture

## Goal
Build a GitHub-connected testing agent that listens for pull request events, reads the source PR and its attached issue, analyzes implementation and testing completeness, and creates or updates an issue comment summarizing implementation gaps, testing notes, blast radius, and likely oversights.

## Success Criteria
- A qualifying GitHub `pull_request` webhook reaches the server.
- The system can inspect the source PR and resolve an attached issue from the PR title or body.
- The system can load the attached issue context and produce a structured review analysis.
- In live mode, the system creates or updates one stable issue comment for that source PR.
- The workflow is testable in slices without requiring a full end-to-end live run for every change.

## Why This Repo Shape Fits
- Reuse `apps/server` because it already hosts the Hono webhook route, central env validation, and AI SDK usage.
- Add a new shared package because PR analysis, issue loading, AI prompting, and issue comment writeback should remain separate from HTTP route code.
- Keep the docs agent package separate so the testing agent can evolve independently without overloading docs-specific types and behavior.

## Proposed Boundaries
### `apps/server`
- Hosts `POST /webhooks/github`.
- Verifies webhook authenticity.
- Converts incoming events into a normalized internal shape.
- Calls the shared testing-agent workflow package.
- Exposes a minimal health or debug route if needed for local replay.

### `packages/github-testing-agent`
- Owns the business logic for the testing agent.
- Contains modules for webhook normalization reuse, PR and issue context loading, attached-issue parsing, structured review analysis, issue comment rendering, and issue comment writeback.
- Holds fixtures and tests for the workflow.

### Shared reuse from `packages/github-doc-agent`
- Webhook signature verification and normalization pattern.
- GitHub App auth and installation-token pattern.
- PR changed-files loading and diff snippet selection pattern.
- Workflow structure for heuristics, model invocation, dry-run versus live mode, and structured log entries.

## End-To-End Workflow
1. GitHub sends a `pull_request` webhook to `apps/server`.
2. The server verifies the signature and filters to supported actions.
3. The server normalizes the payload and passes it to `packages/github-testing-agent`.
4. The agent fetches PR metadata, changed files, and selected diff context from GitHub.
5. The agent resolves the attached issue from issue references in the PR title or body.
6. The agent fetches the attached issue details and any existing bot comment for reconciliation.
7. Deterministic heuristics decide whether the PR is even worth AI evaluation.
8. If relevant, an AI reviewer returns a structured analysis of implementation gaps, testing notes, blast radius, and oversights.
9. In live mode, the agent creates or updates one stable bot-owned comment on the attached issue.
10. Logs capture the event id, source PR number, attached issue number, analysis outcome, and comment writeback result.

## V1 Constraints
- Source PR webhook only, no manual review UI.
- One attached issue per PR.
- Issue references come from the PR title or body, not GitHub linked-issue APIs.
- One stable issue comment per source PR.
- No DB persistence.
- No check runs, PR review comments, or code changes.

## Initial Non-Goals
- Writing code or tests.
- Commenting directly on the source PR.
- Supporting multiple attached issues in one run.
- Building a reviewer UI in `apps/web`.
- Background job infrastructure beyond the request-driven flow.
