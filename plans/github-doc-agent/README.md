# GitHub Doc Agent Plan Set

## Summary
This folder breaks the GitHub docs-agent project into reviewable, implementation-ready slices. The goal is to connect a GitHub PR webhook to the existing server, decide whether a PR requires documentation changes, and if needed generate Fumadocs updates and open a draft PR with those changes.

## Status
| Section | Focus | Status |
| --- | --- | --- |
| [01-overview-and-architecture.md](./01-overview-and-architecture.md) | System shape and boundaries | Planned |
| [02-github-app-and-secrets.md](./02-github-app-and-secrets.md) | Auth model, permissions, env, setup | Planned |
| [03-webhook-intake.md](./03-webhook-intake.md) | Webhook route, verification, normalization | Planned |
| [04-pr-classification.md](./04-pr-classification.md) | PR scanning and docs-needed decision | Planned |
| [05-doc-generation.md](./05-doc-generation.md) | Fumadocs update generation | Planned |
| [06-branch-and-draft-pr.md](./06-branch-and-draft-pr.md) | GitHub writeback and draft PR flow | Planned |
| [07-testing-and-rollout.md](./07-testing-and-rollout.md) | Testing, observability, rollout | Planned |

## Shared Assumptions
- The existing Hono app in `apps/server` will host the webhook and orchestration entrypoint.
- The existing docs surface in `apps/fumadocs/content/docs` is the only writable docs target in v1.
- A new shared package such as `packages/github-doc-agent` will hold GitHub integration and workflow logic.
- The production auth model is a GitHub App, not a long-lived PAT.
- The automation opens a draft PR rather than merging directly.
- V1 is stateless and does not introduce a new database table.

## Terminology
- Source PR: the developer-authored pull request that triggers the workflow.
- Docs PR: the bot-authored draft pull request containing generated documentation changes.
- Webhook event: the GitHub `pull_request` payload received by `apps/server`.
- Classification: the step that decides whether docs are needed and what docs areas are affected.
- Dry run: execution mode that computes the result but does not push branches or open PRs.

## Suggested Order
1. Align on [01-overview-and-architecture.md](./01-overview-and-architecture.md).
2. Finalize setup details in [02-github-app-and-secrets.md](./02-github-app-and-secrets.md).
3. Implement [03-webhook-intake.md](./03-webhook-intake.md).
4. Implement [04-pr-classification.md](./04-pr-classification.md).
5. Implement [05-doc-generation.md](./05-doc-generation.md).
6. Implement [06-branch-and-draft-pr.md](./06-branch-and-draft-pr.md).
7. Keep [07-testing-and-rollout.md](./07-testing-and-rollout.md) current as each slice lands.
