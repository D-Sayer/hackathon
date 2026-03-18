import type {
  DOCS_BOT_BRANCH_PREFIX,
  DOCS_WRITE_TARGET,
  SUPPORTED_GITHUB_WEBHOOK_EVENTS,
  SUPPORTED_PULL_REQUEST_ACTIONS,
} from "./constants";

export type SupportedGitHubWebhookEvent =
  (typeof SUPPORTED_GITHUB_WEBHOOK_EVENTS)[number];

export type SupportedPullRequestAction =
  (typeof SUPPORTED_PULL_REQUEST_ACTIONS)[number];

export type DocsWriteTarget = typeof DOCS_WRITE_TARGET;
export type DocsBotBranchPrefix = typeof DOCS_BOT_BRANCH_PREFIX;

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
      event: NormalizedPullRequestWebhookEvent;
    }
  | {
      ok: false;
      code:
        | "ignored_docs_bot_author"
        | "ignored_docs_bot_branch"
        | "ignored_docs_bot_writeback"
        | "invalid_payload"
        | "unsupported_action"
        | "unsupported_event";
      message: string;
    };

export interface GitHubDocAgentWorkflowInput {
  event: NormalizedPullRequestWebhookEvent;
  mode?: "dry-run" | "live";
}

export interface PullRequestChangedFile {
  additions: number;
  changeType: "added" | "modified" | "removed" | "renamed";
  deletions: number;
  path: string;
  patch?: string;
  previousPath?: string | null;
}

export interface PullRequestClassificationContext {
  body: string;
  changedFiles: PullRequestChangedFile[];
  labels: string[];
  title: string;
}

export interface PullRequestDiffSnippet {
  path: string;
  snippet: string;
}

export interface PullRequestClassification {
  needsDocs: boolean;
  proposedChanges: string[];
  rationale: string;
  targetPages: string[];
}

export type PullRequestClassificationSource =
  | "heuristic"
  | "model"
  | "fallback";

export interface PullRequestHeuristicEvaluation {
  changedFilesConsidered: string[];
  decision?: PullRequestClassification;
  diffSnippets: PullRequestDiffSnippet[];
  filteredChangedFiles: string[];
  shouldSkipModel: boolean;
  source: "heuristic";
}

export interface PullRequestClassifierInput {
  context: PullRequestClassificationContext;
  diffSnippets: PullRequestDiffSnippet[];
  filteredChangedFiles: string[];
}

export type PullRequestClassifier = (
  input: PullRequestClassifierInput,
) => Promise<PullRequestClassification>;

export type PullRequestContextLoader = (
  event: NormalizedPullRequestWebhookEvent,
) => Promise<PullRequestClassificationContext>;

export interface GitHubDocAgentWorkflowResult {
  accepted: boolean;
  code:
    | "accepted"
    | "classified_needs_docs"
    | "classified_no_docs"
    | "dry_run"
    | "workflow_not_configured"
    | "unsupported_action"
    | "unsupported_event";
  classification: PullRequestClassification & {
    changedFilesConsidered: string[];
    source: PullRequestClassificationSource;
    wasModelSkipped: boolean;
  };
  docsWriteTarget: DocsWriteTarget;
  message: string;
  sourcePrNumber: number;
}
