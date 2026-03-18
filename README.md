# GitHub Doc Agent

The GitHub doc agent lives in `packages/github-doc-agent` and is exposed through the server webhook route in `apps/server/src/index.ts`.

## What it does

When the server receives a GitHub `pull_request` webhook at `POST /webhooks/github`, the agent:

1. Verifies the webhook signature.
2. Normalizes the GitHub event.
3. Loads PR file changes from the GitHub API using a GitHub App installation.
4. Classifies whether the PR needs documentation updates.
5. Generates proposed MDX changes under `apps/fumadocs/content/docs`.
6. In `live` mode, creates or updates a docs branch and opens a draft PR.

## Prerequisites

- `bun` 1.3.4 or later
- dependencies installed with `bun install`
- an `apps/server/.env` file
- an OpenAI API key
- a GitHub App with webhook delivery enabled if you want the full workflow

## Required server environment

The server validates env vars from `packages/env/src/server.ts`, so the app will not boot without the core server values below.

Create `apps/server/.env` with at least:

```env
DATABASE_URL=file:../../local.db
BETTER_AUTH_SECRET=replace-with-a-long-random-string-at-least-32-chars
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173

OPENAI_API_KEY=replace-with-your-openai-key

GITHUB_DOC_AGENT_ENABLED=true
GITHUB_DOC_AGENT_MODE=dry-run
GITHUB_WEBHOOK_SECRET=replace-with-your-webhook-secret

GITHUB_APP_ID=replace-with-your-github-app-id
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

DOCS_AGENT_MODEL=gpt-4.1-mini-2025-04-14
```

Notes:

- `GITHUB_APP_PRIVATE_KEY` may be stored as a single quoted string with `\n` line breaks.
- `GITHUB_DOC_AGENT_MODE=dry-run` is the safest local starting point. It classifies and generates docs changes, but does not write back to GitHub.
- `GITHUB_DOC_AGENT_ENABLED` must be `true` and both `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` must be present for the workflow to be considered configured.
- `DOCS_AGENT_DOCS_ROOT` and `DOCS_AGENT_BASE_BRANCH` have defaults, so you usually do not need to set them locally.
- `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` exist in the env schema but are not currently required by the runtime path.

## GitHub App setup

For local testing, create a GitHub App and install it on the target repo.

Recommended permissions:

- Pull requests: `Read & write`
- Contents: `Read & write`
- Metadata: `Read-only`

Recommended webhook subscription:

- Pull requests

Use the same webhook secret from your GitHub App config as `GITHUB_WEBHOOK_SECRET` in `apps/server/.env`.

## Start the server

If you only want the webhook server running:

```bash
bun run dev:server
```

Useful health check:

```bash
curl http://localhost:3000/webhooks/github/health
```

Expected response shape:

```json
{
  "docsWriteTarget": "apps/fumadocs/content/docs",
  "enabled": true,
  "mode": "dry-run",
  "status": "ready"
}
```

## Replay a webhook locally

The repo already includes a replay script at `apps/server/scripts/replay-github-webhook.ps1`.

From the repo root, run:

```bash
bun run --cwd apps/server replay:webhook
```

That script:

- loads `apps/server/.env` by default
- uses the fixture at `packages/github-doc-agent/src/__fixtures__/pull-request-opened.json`
- signs the payload with `GITHUB_WEBHOOK_SECRET`
- posts the webhook to `http://localhost:3000/webhooks/github`

You can override values while replaying. Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\apps\server\scripts\replay-github-webhook.ps1 `
  -PrNumber 123 `
  -Title "Add switch docs" `
  -Owner your-org `
  -Repo your-repo `
  -BaseRef main `
  -HeadRef feature/switch-docs
```

## Dry-run vs live mode

`dry-run` mode:

- verifies the webhook
- fetches PR context from GitHub
- classifies the PR
- generates proposed doc operations
- returns the result in the webhook response
- does not create branches or pull requests in GitHub

`live` mode:

- does everything in `dry-run`
- creates or reuses a docs branch
- commits generated MDX updates
- creates or updates a draft PR in GitHub

To enable live mode, change:

```env
GITHUB_DOC_AGENT_MODE=live
```

Only switch to `live` after you have confirmed the dry-run response looks correct.

## Typical local workflow

1. Run `bun install`.
2. Fill out `apps/server/.env`.
3. Start the server with `bun run dev:server`.
4. Check `http://localhost:3000/webhooks/github/health`.
5. Replay a webhook with `bun run --cwd apps/server replay:webhook`.
6. Inspect the JSON response in the terminal.
7. When dry-run looks good, switch `GITHUB_DOC_AGENT_MODE` to `live` and replay again.

## Useful commands

- `bun run dev:server` - run only the backend server
- `bun run check-types` - run workspace TypeScript checks
- `bun run test` - run workspace tests
- `bun run --cwd apps/server replay:webhook` - send a local GitHub webhook fixture

## Troubleshooting

- `workflow_not_configured`: usually means `GITHUB_DOC_AGENT_ENABLED` is not `true`, or GitHub App env vars are missing.
- `webhook_secret_not_configured`: `GITHUB_WEBHOOK_SECRET` is missing from `apps/server/.env`.
- `401` on webhook replay: the replay script and server are using different webhook secrets.
- `503` from the workflow: the server started, but GitHub or AI configuration is incomplete for the path being exercised.
- health endpoint shows `enabled: false`: your `.env` was not loaded or still has `GITHUB_DOC_AGENT_ENABLED=false`.
