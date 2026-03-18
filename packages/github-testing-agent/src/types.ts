import type {
  SUPPORTED_GITHUB_WEBHOOK_EVENTS,
  SUPPORTED_PULL_REQUEST_ACTIONS,
} from "./constants";

export type SupportedGitHubWebhookEvent =
  (typeof SUPPORTED_GITHUB_WEBHOOK_EVENTS)[number];

export type SupportedPullRequestAction =
  (typeof SUPPORTED_PULL_REQUEST_ACTIONS)[number];

export interface GitHubWebhookHeaders {
  deliveryId: string | null;
  eventName: string | null;
  signature256: string | null;
}

export interface GitHubWebhookSignatureVerificationResult {
  ok: boolean;
  code:
    | "missing_signature"
    | "signature_mismatch"
    | "webhook_secret_not_configured";
  message: string;
}

export interface NormalizedTestingPullRequestWebhookEvent {
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
    author: string;
    baseRef: string;
    body: string;
    draft: boolean;
    headRef: string;
    htmlUrl: string;
    number: number;
    title: string;
  };
  sender: {
    login: string;
  };
  receivedAt: string;
}

export type GitHubWebhookNormalizationResult =
  | {
      ok: true;
      event: NormalizedTestingPullRequestWebhookEvent;
    }
  | {
      ok: false;
      code:
        | "ignored_bot_author"
        | "ignored_bot_branch"
        | "invalid_payload"
        | "unsupported_action"
        | "unsupported_event";
      message: string;
    };

export interface GitHubTestingAgentWorkflowInput {
  event: NormalizedTestingPullRequestWebhookEvent;
  mode?: "dry-run" | "live";
}

export interface GitHubTestingAgentWorkflowResult {
  accepted: boolean;
  code: "accepted" | "dry_run" | "workflow_not_configured";
  message: string;
  sourcePrNumber: number;
}

export interface GitHubTestingAgentWorkflowLogEntry {
  accepted: boolean;
  action: SupportedPullRequestAction;
  code: GitHubTestingAgentWorkflowResult["code"];
  deliveryId: string | null;
  eventName: SupportedGitHubWebhookEvent;
  mode: "dry-run" | "live";
  sourcePrNumber: number;
}
