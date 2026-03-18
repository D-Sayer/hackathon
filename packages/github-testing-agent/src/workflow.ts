import { evaluatePullRequestReviewHeuristics } from "./analyze-review";
import type {
  GitHubTestingAgentWorkflowInput,
  GitHubTestingAgentWorkflowResult,
  PullRequestReviewAnalysis,
  PullRequestReviewAnalysisSource,
  PullRequestReviewAnalyzer,
  PullRequestReviewContext,
  PullRequestReviewContextLoader,
} from "./types";

export interface GitHubTestingAgentWorkflowDependencies {
  analyzer?: PullRequestReviewAnalyzer;
  isConfigured?: boolean;
  loadPullRequestReviewContext?: PullRequestReviewContextLoader;
}

function createFallbackAnalysis(params: {
  changedFilesConsidered: string[];
  rationale: string;
  summary: string;
}): GitHubTestingAgentWorkflowResult["analysis"] {
  return {
    blastRadius: [],
    changedFilesConsidered: params.changedFilesConsidered,
    confidence: "low",
    implementationGaps: [],
    oversights: [],
    rationale: params.rationale,
    shouldComment: false,
    source: "fallback",
    summary: params.summary,
    testingNotes: [],
    wasModelSkipped: true,
  };
}

function buildWorkflowMessage(params: {
  analysis: PullRequestReviewAnalysis;
  context: PullRequestReviewContext;
  mode: "dry-run" | "live";
  source: PullRequestReviewAnalysisSource;
}): string {
  const prefix =
    params.mode === "live"
      ? "Review analysis completed for the testing agent."
      : "Review analysis completed in dry-run mode for the testing agent.";
  const decision = params.analysis.shouldComment
    ? "Actionable issue follow-up was identified."
    : "No issue feedback comment is needed.";
  const attachedIssueMessage = params.context.attachedIssueReference
    ? params.context.attachedIssue
      ? ` Attached issue #${params.context.attachedIssue.number} was loaded from the ${params.context.attachedIssueReference.source}.`
      : ` Attached issue #${params.context.attachedIssueReference.number} was referenced in the ${params.context.attachedIssueReference.source}, but GitHub did not return issue details.`
    : " No attached issue reference was found in the PR title or body.";
  const existingCommentMessage = params.context.existingFeedbackComment
    ? ` Existing feedback comment ${params.context.existingFeedbackComment.commentId} was found on the issue.`
    : "";

  return `${prefix} ${decision} Decision source: ${params.source}.${attachedIssueMessage}${existingCommentMessage}`;
}

export async function runGitHubTestingAgentWorkflow(
  input: GitHubTestingAgentWorkflowInput,
  dependencies: GitHubTestingAgentWorkflowDependencies = {},
): Promise<GitHubTestingAgentWorkflowResult> {
  const mode = input.mode ?? "dry-run";

  if (dependencies.isConfigured === false) {
    return {
      accepted: false,
      analysis: createFallbackAnalysis({
        changedFilesConsidered: [],
        rationale:
          "The workflow is not configured, so pull request review analysis did not run.",
        summary:
          "Review analysis did not run because the testing agent is not enabled.",
      }),
      code: "workflow_not_configured",
      context: null,
      message:
        "The testing agent intake is wired, but the workflow is not enabled yet.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  if (!dependencies.loadPullRequestReviewContext) {
    return {
      accepted: false,
      analysis: createFallbackAnalysis({
        changedFilesConsidered: [],
        rationale:
          "The workflow cannot analyze this pull request because no PR and issue review context loader is configured.",
        summary:
          "Review analysis did not run because PR and issue context loading is not configured.",
      }),
      code: "workflow_not_configured",
      context: null,
      message:
        "The testing agent workflow needs a PR and issue context loader before review can run.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  const context = await dependencies.loadPullRequestReviewContext(input.event);
  const heuristicEvaluation = evaluatePullRequestReviewHeuristics(context);
  let analysis: PullRequestReviewAnalysis;
  let source: PullRequestReviewAnalysisSource = heuristicEvaluation.source;
  let wasModelSkipped = heuristicEvaluation.shouldSkipModel;

  if (heuristicEvaluation.shouldSkipModel && heuristicEvaluation.decision) {
    analysis = heuristicEvaluation.decision;
  } else if (dependencies.analyzer) {
    analysis = await dependencies.analyzer({
      context,
      diffSnippets: heuristicEvaluation.diffSnippets,
      filteredChangedFiles: heuristicEvaluation.filteredChangedFiles,
    });
    source = "model";
    wasModelSkipped = false;
  } else {
    analysis = {
      blastRadius: heuristicEvaluation.filteredChangedFiles.map(
        (path) => `Changed surface: ${path}`,
      ),
      confidence: "low",
      implementationGaps: [
        "Review the linked issue against the touched code paths to confirm the shipped scope fully matches the requested outcome.",
      ],
      oversights: [],
      rationale:
        "Positive implementation signals were found, but no AI review analyzer is configured. Falling back to a conservative should-comment decision.",
      shouldComment: true,
      summary:
        "Potential implementation or testing follow-up is likely, but no AI review analyzer is configured to summarize the findings precisely.",
      testingNotes: [
        "Validate the touched server, web, and shared package changes with focused tests or manual verification before closing the linked issue.",
      ],
    };
    source = "fallback";
    wasModelSkipped = true;
  }

  return {
    accepted: true,
    analysis: {
      ...analysis,
      changedFilesConsidered: heuristicEvaluation.changedFilesConsidered,
      source,
      wasModelSkipped,
    },
    code: mode === "live" ? "accepted" : "dry_run",
    context: {
      attachedIssueNumber: context.attachedIssue?.number ?? null,
      changedFileCount: context.changedFiles.length,
      diffSnippetCount: context.diffSnippets.length,
      existingFeedbackCommentId: context.existingFeedbackComment?.commentId ?? null,
      issueReferenceSource: context.attachedIssueReference?.source ?? null,
    },
    message: buildWorkflowMessage({
      analysis,
      context,
      mode,
      source,
    }),
    sourcePrNumber: input.event.pullRequest.number,
  };
}
