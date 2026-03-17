import type {
  DOCS_WRITE_TARGET,
  SUPPORTED_GITHUB_WEBHOOK_EVENTS,
  SUPPORTED_PULL_REQUEST_ACTIONS,
} from "./constants";

export type SupportedGitHubWebhookEvent =
  (typeof SUPPORTED_GITHUB_WEBHOOK_EVENTS)[number];

export type SupportedPullRequestAction =
  (typeof SUPPORTED_PULL_REQUEST_ACTIONS)[number];

export type DocsWriteTarget = typeof DOCS_WRITE_TARGET;

export interface GitHubWebhookHeaders {
  deliveryId: string | null;
  eventName: string | null;
  signature256: string | null;
}

export interface NormalizedPullRequestWebhookEvent {
  action: SupportedPullRequestAction;
  deliveryId: string | null;
  eventName: SupportedGitHubWebhookEvent;
  installationId: number | null;
  repository: {
    defaultBranch: string;
    fullName: string;
    name: string;
    owner: string;
  };
  pullRequest: {
    baseRef: string;
    draft: boolean;
    headRef: string;
    htmlUrl: string;
    number: number;
    title: string;
  };
  receivedAt: string;
}

export type GitHubWebhookNormalizationResult =
  | {
      ok: true;
      event: NormalizedPullRequestWebhookEvent;
    }
  | {
      ok: false;
      code: "invalid_payload" | "unsupported_action" | "unsupported_event";
      message: string;
    };

export interface GitHubDocAgentWorkflowInput {
  event: NormalizedPullRequestWebhookEvent;
  mode?: "dry-run" | "live";
}

export interface GitHubDocAgentWorkflowResult {
  accepted: boolean;
  code:
    | "accepted"
    | "dry_run"
    | "workflow_not_configured"
    | "unsupported_action"
    | "unsupported_event";
  docsWriteTarget: DocsWriteTarget;
  message: string;
  sourcePrNumber: number;
}
