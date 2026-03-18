# 04 PR And Issue Context Loading

## Objective
Implement the context-loading slice: fetch the source PR details needed for review, resolve the attached issue from the PR text, and load the issue details required for analysis and comment reconciliation.

## Inputs
- Normalized webhook event from the intake step
- GitHub App installation context

## Reuse From The Docs Agent
- Reuse the GitHub App JWT and installation-token flow.
- Reuse PR changed-files loading from the GitHub pull request files API.
- Reuse changed-file mapping and selected diff snippet patterns so the model input stays consistent with the docs agent.

## New Capabilities
- Parse issue references from the PR title or body.
- Fetch the attached issue title and body.
- Fetch issue comments only to identify an existing bot-owned comment for this source PR.

## V1 Attached Issue Resolution Rules
- Support one attached issue per PR.
- Parse references such as `Fixes #123`, `Closes #123`, `Resolves #123`, and plain `#123`.
- Select the first resolvable issue reference found in the PR title or body.
- If no issue is referenced, return `attachedIssue=null` and let the workflow exit safely without writeback.
- If multiple issue references exist, record which issue was selected in the workflow rationale for debugging.

## Proposed Internal Types
- `PullRequestReviewContext`
- `AttachedIssueReference`
- `IssueContext`
- `ExistingIssueFeedbackComment`

The combined context should include:
- PR title and body
- changed files
- selected diff snippets
- attached issue number, title, and body when found
- existing bot comment metadata when found

## API Shape
- Add a PR and issue context loader in the new package rather than extending the docs-agent loader directly.
- Keep the loader output review-focused and independent from any specific model prompt.
- Keep issue comment lookup separate from analysis logic so it can be mocked independently.

## Test Fixtures And Cases
- PR with one issue reference in the body
- PR with one issue reference in the title
- PR with no issue reference
- PR with multiple issue references
- referenced issue missing or inaccessible
- existing bot comment present
- existing bot comment absent

## Done Criteria
- The workflow can load PR changed files and selected diff context.
- The workflow can resolve one attached issue from PR text in representative cases.
- The workflow can fetch issue details and existing bot comment state.
- Tests cover both happy-path and missing-issue scenarios.
