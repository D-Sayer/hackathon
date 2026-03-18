# GitHub Testing Agent Plan Set

## Summary
This folder breaks the GitHub testing-agent project into reviewable, implementation-ready slices. The goal is to connect a GitHub PR webhook to the existing server, read the source PR and its attached issue, analyze implementation and testing completeness, and create or update one stable issue comment with implementation gaps, testing notes, blast radius, oversights, and other follow-up observations.

## Status
| Section | Focus | Status |
| --- | --- | --- |
| [01-overview-and-architecture.md](./01-overview-and-architecture.md) | System shape and boundaries | Planned |
| [02-github-app-and-secrets.md](./02-github-app-and-secrets.md) | Auth model, permissions, env, setup | Planned |
| [03-webhook-intake-and-normalized-contract.md](./03-webhook-intake-and-normalized-contract.md) | Webhook route, verification, normalization | Planned |
| [04-pr-and-issue-context-loading.md](./04-pr-and-issue-context-loading.md) | PR context, attached issue resolution, issue loading | Planned |
| [05-review-classification-and-analysis.md](./05-review-classification-and-analysis.md) | Structured review analysis | Planned |
| [06-issue-comment-rendering-and-writeback.md](./06-issue-comment-rendering-and-writeback.md) | Issue comment creation and update flow | Planned |
| [07-testing-and-rollout.md](./07-testing-and-rollout.md) | Testing, observability, rollout | Planned |

## Shared Assumptions
- The existing Hono app in `apps/server` will host the webhook and orchestration entrypoint.
- A new shared package such as `packages/github-testing-agent` will hold GitHub integration and workflow logic.
- The production auth model is a GitHub App, not a long-lived PAT.
- V1 attached issue resolution will use issue references found in the PR title or body.
- V1 supports one attached issue per PR and picks the first resolvable reference.
- The automation creates or updates one stable bot-owned issue comment per source PR.
- V1 is stateless and does not introduce a new database table.

## Terminology
- Source PR: the developer-authored pull request that triggers the workflow.
- Attached issue: the issue referenced from the source PR title or body.
- Issue feedback comment: the bot-authored comment posted to the attached issue.
- Review analysis: the structured result describing gaps, testing notes, blast radius, and oversights.
- Dry run: execution mode that computes the result but does not write comments to GitHub.

## Reuse Strategy
- Reuse the existing webhook verification and normalization pattern from the docs agent.
- Reuse the existing GitHub App token and PR changed-files loading approach where possible.
- Reuse the same workflow structure: heuristics first, AI step second, dry-run versus live mode, structured logging, and fixture-heavy tests.
- Extract shared helpers only after the second agent exists and duplication is concrete.

## Suggested Order
1. Align on [01-overview-and-architecture.md](./01-overview-and-architecture.md).
2. Finalize setup details in [02-github-app-and-secrets.md](./02-github-app-and-secrets.md).
3. Implement [03-webhook-intake-and-normalized-contract.md](./03-webhook-intake-and-normalized-contract.md).
4. Implement [04-pr-and-issue-context-loading.md](./04-pr-and-issue-context-loading.md).
5. Implement [05-review-classification-and-analysis.md](./05-review-classification-and-analysis.md).
6. Implement [06-issue-comment-rendering-and-writeback.md](./06-issue-comment-rendering-and-writeback.md).
7. Keep [07-testing-and-rollout.md](./07-testing-and-rollout.md) current as each slice lands.
