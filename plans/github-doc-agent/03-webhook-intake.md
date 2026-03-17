# 03 Webhook Intake

## Objective
Implement the first delivery slice: receive GitHub PR webhooks in `apps/server`, verify authenticity, filter to supported actions, and normalize events into a stable internal contract for the rest of the workflow.

## Route Shape
- Add `POST /webhooks/github` to `apps/server`.
- Optionally add a lightweight `GET /webhooks/github/health` or similar debug route for local sanity checks.
- Keep the route narrow and focused on webhook intake only.

## Verification
- Validate `X-Hub-Signature-256` using `GITHUB_WEBHOOK_SECRET`.
- Reject missing or invalid signatures with `401`.
- Reject malformed payloads with `400`.
- Log event id and event type without logging secrets or raw signatures.

## Accepted Events
- Only process `pull_request` events.
- Only allow actions:
  - `opened`
  - `edited`
  - `reopened`
  - `synchronize`
- Return a fast `202` or `200` for ignored but valid events so GitHub does not retry unnecessarily.

## Normalized Internal Contract
Create a typed event object passed to the shared package with fields such as:

- `deliveryId`
- `eventName`
- `action`
- `repository.owner`
- `repository.name`
- `pullRequest.number`
- `pullRequest.title`
- `pullRequest.body`
- `pullRequest.htmlUrl`
- `pullRequest.baseRef`
- `pullRequest.headRef`
- `pullRequest.author`
- `sender.login`

Keep this contract intentionally small and stable so later stages do not depend on raw GitHub payload shape everywhere.

## Loop Prevention Rules
- Ignore events where the source PR author is the docs bot account.
- Ignore PRs whose branch name matches the docs bot branch pattern.
- Ignore PRs that only touch the allowed docs path when they are clearly docs-bot writeback PRs.

## Testing Plan For This Slice
- Unit test valid signature verification.
- Unit test invalid signature rejection.
- Unit test supported versus ignored event/action filtering.
- Unit test normalization of a representative `pull_request` payload into the internal contract.

## Local Replay Approach
- Store one or more sample webhook fixtures in the shared package test fixtures.
- Add a simple local replay helper or test that posts a saved payload to the Hono route.
- Run with `DOCS_AGENT_DRY_RUN=true`.

## Done Criteria
- The server accepts and verifies a real or fixture-based GitHub `pull_request` webhook.
- Unsupported events are ignored safely.
- Supported events produce a normalized typed object for the next workflow stage.
- Tests cover signature verification, filtering, and normalization.
