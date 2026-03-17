# 02 GitHub App And Secrets

## Auth Decision
Use a GitHub App as the primary integration model.

Why:
- It matches the webhook-driven architecture cleanly.
- It avoids a broad long-lived PAT for production.
- It provides install-scoped repository access and better permission control.
- It scales better if this agent later expands beyond one repository.

## PAT Position
Do not use a PAT in the main production path.

Optional dev fallback:
- A fine-grained PAT may be used for local experiments if GitHub App setup is temporarily blocked.
- If used, scope it to the target repository only and grant the smallest possible permissions.

## Required GitHub App Permissions
- `Metadata: Read-only`
- `Contents: Read & write`
- `Pull requests: Read & write`

Optional later permissions:
- `Issues: Read & write` for comments on source PRs
- `Checks: Read & write` for richer status reporting

## Required Webhook Subscription
- `Pull request`

Supported actions in v1:
- `opened`
- `edited`
- `reopened`
- `synchronize`

Ignored actions:
- `closed`
- `converted_to_draft`
- `ready_for_review`
- any event emitted by the docs bot itself

## Required Environment Variables
Add to the server env package and server runtime config:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `DOCS_AGENT_MODEL`
- `DOCS_AGENT_DOCS_ROOT`
- `DOCS_AGENT_BASE_BRANCH`
- `DOCS_AGENT_DRY_RUN`

Existing secret reused:
- `OPENAI_API_KEY`

Suggested defaults:
- `DOCS_AGENT_DOCS_ROOT=apps/fumadocs/content/docs`
- `DOCS_AGENT_BASE_BRANCH=main`
- `DOCS_AGENT_DRY_RUN=true` in early development

## Security Note
The current `apps/server/.env` contains a live-looking OpenAI key. Rotate it before real integration work, testing against GitHub, or sharing the repo.

## Local Setup Checklist
1. Create the GitHub App in the target GitHub org or user account.
2. Set the webhook URL to the reachable server endpoint.
3. Generate and store the private key securely.
4. Install the GitHub App on the target repository.
5. Populate local `.env` values for the app id, private key, webhook secret, and repo identifiers.
6. Keep `DOCS_AGENT_DRY_RUN=true` until branch writeback is ready.

## Production Setup Checklist
1. Store all GitHub and AI secrets in the deployment secret manager.
2. Confirm the deployed webhook URL is stable and HTTPS.
3. Verify the app is installed on the intended repository only.
4. Enable dry run first.
5. Validate event receipt, classification, and generation before enabling GitHub writes.
