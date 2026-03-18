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

export interface TestingPullRequestChangedFile {
  additions: number;
  changeType: "added" | "modified" | "removed" | "renamed";
  deletions: number;
  path: string;
  patch?: string;
  previousPath?: string | null;
}

export interface PullRequestDiffSnippet {
  path: string;
  snippet: string;
}

export interface AttachedIssueReference {
  keyword: "closes" | "fixes" | "reference" | "resolves";
  matchedText: string;
  number: number;
  owner: string;
  repo: string;
  source: "body" | "title";
}

export interface IssueContext {
  body: string;
  htmlUrl: string;
  number: number;
  state: "closed" | "open" | "unknown";
  title: string;
}

export interface ExistingIssueFeedbackComment {
  authorLogin: string;
  body: string;
  commentId: number;
  htmlUrl: string;
}

export interface PullRequestReviewContext {
  attachedIssue: IssueContext | null;
  attachedIssueReference: AttachedIssueReference | null;
  changedFiles: TestingPullRequestChangedFile[];
  diffSnippets: PullRequestDiffSnippet[];
  existingFeedbackComment: ExistingIssueFeedbackComment | null;
  issueSelectionRationale: string | null;
  pullRequestBody: string;
  pullRequestTitle: string;
}

export interface PullRequestReviewAnalysis {
  blastRadius: string[];
  confidence: "low" | "medium" | "high";
  implementationGaps: string[];
  oversights: string[];
  rationale: string;
  shouldComment: boolean;
  summary: string;
  testingNotes: string[];
}

export type PullRequestReviewAnalysisSource =
  | "heuristic"
  | "model"
  | "fallback";

export interface PullRequestReviewHeuristicEvaluation {
  changedFilesConsidered: string[];
  decision?: PullRequestReviewAnalysis;
  diffSnippets: PullRequestDiffSnippet[];
  filteredChangedFiles: string[];
  shouldSkipModel: boolean;
  source: "heuristic";
}

export interface PullRequestReviewAnalyzerInput {
  context: PullRequestReviewContext;
  diffSnippets: PullRequestDiffSnippet[];
  filteredChangedFiles: string[];
}

export type PullRequestReviewAnalyzer = (
  input: PullRequestReviewAnalyzerInput,
) => Promise<PullRequestReviewAnalysis>;

export type PullRequestReviewContextLoader = (
  event: NormalizedTestingPullRequestWebhookEvent,
) => Promise<PullRequestReviewContext>;

export interface GitHubTestingAgentWorkflowResult {
  accepted: boolean;
  code: "accepted" | "dry_run" | "workflow_not_configured";
  analysis: PullRequestReviewAnalysis & {
    changedFilesConsidered: string[];
    source: PullRequestReviewAnalysisSource;
    wasModelSkipped: boolean;
  };
  context:
    | null
    | {
        attachedIssueNumber: number | null;
        changedFileCount: number;
        diffSnippetCount: number;
        existingFeedbackCommentId: number | null;
        issueReferenceSource: "body" | "title" | null;
      };
  message: string;
  sourcePrNumber: number;
}

export interface GitHubTestingAgentWorkflowLogEntry {
  accepted: boolean;
  action: SupportedPullRequestAction;
  analysisShouldComment: boolean;
  analysisSource: PullRequestReviewAnalysisSource;
  attachedIssueNumber: number | null;
  code: GitHubTestingAgentWorkflowResult["code"];
  confidence: PullRequestReviewAnalysis["confidence"];
  deliveryId: string | null;
  eventName: SupportedGitHubWebhookEvent;
  mode: "dry-run" | "live";
  sourcePrNumber: number;
  wasModelSkipped: boolean;
}
