export const TESTING_BOT_BRANCH_PREFIX = "testing-bot/pr-" as const;

export const SUPPORTED_GITHUB_WEBHOOK_EVENTS = ["pull_request"] as const;

export const SUPPORTED_PULL_REQUEST_ACTIONS = [
  "opened",
  "edited",
  "reopened",
  "synchronize",
] as const;
