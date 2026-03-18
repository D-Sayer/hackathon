# 03 Webhook Intake And Normalized Contract

## Objective
Implement the first delivery slice: receive GitHub PR webhooks in `apps/server`, verify authenticity, filter to supported actions, and normalize events into a stable internal contract for the testing-agent workflow.

## Route Shape
- Reuse `POST /webhooks/github` in `apps/server`.
- Keep the route narrow and focused on webhook intake and orchestration.
- Reuse or extend the existing health route for local sanity checks if needed.

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
- Return a fast `202` for ignored but valid events so GitHub does not retry unnecessarily.

## Normalized Internal Contract
Create or reuse a typed event object passed to the shared package with fields such as:

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

## Reuse And Extraction Guidance
- Start by reusing the current docs-agent verification and normalization behavior.
- If both agents need the exact same webhook helpers, extract shared utilities only after the testing-agent slice reaches parity.
- Do not block the new agent on a large shared refactor.

## Loop Prevention Rules
- Ignore events authored by the bot account.
- Ignore events whose branch name matches a future testing-agent bot branch pattern if one is introduced later.
- Keep loop prevention generic rather than docs-specific so it can support multiple agents safely.

## Testing Plan For This Slice
- Unit test valid signature verification.
- Unit test invalid signature rejection.
- Unit test supported versus ignored event/action filtering.
- Unit test normalization of a representative `pull_request` payload into the internal contract.
- Unit test that the testing-agent route path does not require issue context yet.

## Local Replay Approach
- Reuse saved webhook fixtures from the existing pattern where possible.
- Add a local replay helper or route test that posts a saved payload to the Hono route.
- Run with `GITHUB_TESTING_AGENT_MODE=dry-run`.

## Done Criteria
- The server accepts and verifies a real or fixture-based GitHub `pull_request` webhook.
- Unsupported events are ignored safely.
- Supported events produce a normalized typed object for the next workflow stage.
- Tests cover signature verification, filtering, and normalization.
