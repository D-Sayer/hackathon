import { evaluatePullRequestReviewHeuristics } from "./analyze-review";
import {
  createSkippedWritebackResult,
  findMatchingIssueFeedbackComment,
  renderIssueFeedbackComment,
} from "./issue-comment";
import type {
  GitHubTestingAgentWorkflowInput,
  GitHubTestingAgentWorkflowResult,
  IssueCommentWritebackClient,
  IssueFeedbackCommentRenderer,
  PullRequestReviewAnalysis,
  PullRequestReviewAnalysisSource,
  PullRequestReviewAnalyzer,
  PullRequestReviewContext,
  PullRequestReviewContextLoader,
} from "./types";

export interface GitHubTestingAgentWorkflowDependencies {
  agentIdentity?: string;
  analyzer?: PullRequestReviewAnalyzer;
  isConfigured?: boolean;
  issueCommentClient?: IssueCommentWritebackClient;
  loadPullRequestReviewContext?: PullRequestReviewContextLoader;
  renderIssueFeedbackComment?: IssueFeedbackCommentRenderer;
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
  writeback: GitHubTestingAgentWorkflowResult["writeback"];
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
  const writebackMessage =
    params.writeback.status === "created"
      ? ` Created issue feedback comment ${params.writeback.commentId}.`
      : params.writeback.status === "updated"
        ? ` Updated issue feedback comment ${params.writeback.commentId}.`
        : params.writeback.status === "unchanged"
          ? " Existing issue feedback comment was already up to date."
          : params.writeback.status === "dry_run"
            ? " Rendered the issue feedback comment in dry-run mode without writing to GitHub."
            : params.writeback.status === "failed"
              ? ` Issue comment writeback failed: ${params.writeback.errorMessage}`
              : "";

  return `${prefix} ${decision} Decision source: ${params.source}.${attachedIssueMessage}${existingCommentMessage}${writebackMessage}`;
}

export async function runGitHubTestingAgentWorkflow(
  input: GitHubTestingAgentWorkflowInput,
  dependencies: GitHubTestingAgentWorkflowDependencies = {},
): Promise<GitHubTestingAgentWorkflowResult> {
  const mode = input.mode ?? "dry-run";
  const agentIdentity = dependencies.agentIdentity ?? "github-testing-agent";

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
      writeback: createSkippedWritebackResult("skipped", null),
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
      writeback: createSkippedWritebackResult("skipped", null),
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

  let writeback: GitHubTestingAgentWorkflowResult["writeback"] =
    createSkippedWritebackResult("not_needed", null);

  if (analysis.shouldComment && context.attachedIssue) {
    try {
      const renderedComment = (
        dependencies.renderIssueFeedbackComment ?? renderIssueFeedbackComment
      )({
        agentIdentity,
        analysis,
        attachedIssue: context.attachedIssue,
        sourcePullRequest: input.event.pullRequest,
      });

      if (mode === "dry-run") {
        writeback = createSkippedWritebackResult("dry_run", renderedComment.body);
      } else if (!dependencies.issueCommentClient) {
        writeback = {
          commentId: null,
          errorMessage:
            "Issue comment writeback is not configured for live mode.",
          renderedBody: renderedComment.body,
          status: "failed",
        };
      } else {
        const latestComments = await dependencies.issueCommentClient.listIssueComments({
          event: input.event,
          issueNumber: context.attachedIssue.number,
        });
        const existingComment = findMatchingIssueFeedbackComment({
          agentIdentity,
          comments: latestComments,
          sourcePrNumber: input.event.pullRequest.number,
          sourcePrUrl: input.event.pullRequest.htmlUrl,
        });

        if (existingComment && existingComment.body === renderedComment.body) {
          writeback = {
            commentId: existingComment.commentId,
            errorMessage: null,
            renderedBody: renderedComment.body,
            status: "unchanged",
          };
        } else if (existingComment) {
          const updatedComment =
            await dependencies.issueCommentClient.updateIssueComment({
              body: renderedComment.body,
              commentId: existingComment.commentId,
              event: input.event,
            });

          writeback = {
            commentId: updatedComment.commentId,
            errorMessage: null,
            renderedBody: renderedComment.body,
            status: "updated",
          };
        } else {
          const createdComment =
            await dependencies.issueCommentClient.createIssueComment({
              body: renderedComment.body,
              event: input.event,
              issueNumber: context.attachedIssue.number,
            });

          writeback = {
            commentId: createdComment.commentId,
            errorMessage: null,
            renderedBody: renderedComment.body,
            status: "created",
          };
        }
      }
    } catch (error) {
      writeback = {
        commentId: null,
        errorMessage:
          error instanceof Error ? error.message : "Unknown writeback error.",
        renderedBody: null,
        status: "failed",
      };
    }
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
      writeback,
    }),
    sourcePrNumber: input.event.pullRequest.number,
    writeback,
  };
}
