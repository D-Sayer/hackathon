export const DOCS_WRITE_TARGET = "apps/fumadocs/content/docs" as const;

export const SUPPORTED_GITHUB_WEBHOOK_EVENTS = ["pull_request"] as const;

export const SUPPORTED_PULL_REQUEST_ACTIONS = [
  "opened",
  "edited",
  "reopened",
  "ready_for_review",
  "synchronize",
] as const;
