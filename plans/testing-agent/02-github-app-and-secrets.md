# 02 GitHub App And Secrets

## Auth Decision
Use a GitHub App as the primary integration model.

Why:
- It matches the webhook-driven architecture already used by the docs agent.
- It avoids a broad long-lived PAT for production.
- It provides install-scoped repository access and better permission control.
- It allows the agent to read PRs and write issue comments without mixing unrelated credentials.

## PAT Position
Do not use a PAT in the main production path.

Optional dev fallback:
- A fine-grained PAT may be used for local experiments if GitHub App setup is temporarily blocked.
- If used, scope it to the target repository only and grant the smallest possible permissions.

## Required GitHub App Permissions
- `Metadata: Read-only`
- `Pull requests: Read-only`
- `Issues: Read & write`

Optional later permissions:
- `Checks: Read & write` for richer status reporting
- `Contents: Read-only` if later analysis needs additional repository file fetches outside the PR file list

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
- any event emitted by the bot itself

## Required Environment Variables
Add to the server env package and server runtime config:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `TESTING_AGENT_MODEL`
- `GITHUB_TESTING_AGENT_ENABLED`
- `GITHUB_TESTING_AGENT_MODE`

Existing secrets reused:
- `OPENAI_API_KEY`

Suggested defaults:
- `GITHUB_TESTING_AGENT_ENABLED=false`
- `GITHUB_TESTING_AGENT_MODE=dry-run`

## Bot Identity And Writeback Strategy
- Use a stable bot marker in issue comments so reruns can find and update the existing comment for the source PR.
- Keep the comment body deterministic enough that unchanged runs can optionally skip unnecessary updates.
- Treat comment update capability as required in v1 so the agent does not spam issues on each PR synchronize event.

## Local Setup Checklist
1. Create or reuse the GitHub App in the target GitHub org or user account.
2. Set the webhook URL to the reachable server endpoint.
3. Generate and store the private key securely.
4. Install the GitHub App on the target repository.
5. Populate local `.env` values for the app id, private key, webhook secret, and testing-agent mode.
6. Keep `GITHUB_TESTING_AGENT_MODE=dry-run` until issue comment writeback is ready.

## Production Setup Checklist
1. Store all GitHub and AI secrets in the deployment secret manager.
2. Confirm the deployed webhook URL is stable and HTTPS.
3. Verify the app is installed on the intended repository only.
4. Enable dry run first.
5. Validate event receipt, attached issue resolution, analysis, and rendered comment output before enabling GitHub writes.
