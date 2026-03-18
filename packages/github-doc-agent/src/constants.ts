export const DOCS_WRITE_TARGET = "apps/fumadocs/content/docs" as const;
export const DOCS_BOT_BRANCH_PREFIX = "docs-bot/pr-" as const;

export const SUPPORTED_GITHUB_WEBHOOK_EVENTS = ["pull_request"] as const;

export const SUPPORTED_PULL_REQUEST_ACTIONS = [
  "opened",
  "edited",
  "reopened",
  "synchronize",
] as const;
