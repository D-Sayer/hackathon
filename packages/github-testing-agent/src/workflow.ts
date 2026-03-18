import type {
  GitHubTestingAgentWorkflowInput,
  GitHubTestingAgentWorkflowResult,
  PullRequestReviewContextLoader,
} from "./types";

export interface GitHubTestingAgentWorkflowDependencies {
  isConfigured?: boolean;
  loadPullRequestReviewContext?: PullRequestReviewContextLoader;
}

export async function runGitHubTestingAgentWorkflow(
  input: GitHubTestingAgentWorkflowInput,
  dependencies: GitHubTestingAgentWorkflowDependencies = {},
): Promise<GitHubTestingAgentWorkflowResult> {
  const mode = input.mode ?? "dry-run";

  if (dependencies.isConfigured === false) {
    return {
      accepted: false,
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
      code: "workflow_not_configured",
      context: null,
      message:
        "The testing agent workflow needs a PR and issue context loader before review can run.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  const context = await dependencies.loadPullRequestReviewContext(input.event);
  const attachedIssueMessage = context.attachedIssueReference
    ? context.attachedIssue
      ? `Attached issue #${context.attachedIssue.number} was loaded from the ${context.attachedIssueReference.source}.`
      : `Attached issue #${context.attachedIssueReference.number} was referenced in the ${context.attachedIssueReference.source}, but GitHub did not return issue details.`
    : "No attached issue reference was found in the PR title or body, so the workflow exited safely.";
  const existingCommentMessage = context.existingFeedbackComment
    ? ` Existing feedback comment ${context.existingFeedbackComment.commentId} was found on the issue.`
    : "";

  return {
    accepted: true,
    code: mode === "live" ? "accepted" : "dry_run",
    context: {
      attachedIssueNumber: context.attachedIssue?.number ?? null,
      changedFileCount: context.changedFiles.length,
      diffSnippetCount: context.diffSnippets.length,
      existingFeedbackCommentId: context.existingFeedbackComment?.commentId ?? null,
      issueReferenceSource: context.attachedIssueReference?.source ?? null,
    },
    message:
      mode === "live"
        ? `The testing agent loaded PR and issue review context. ${attachedIssueMessage}${existingCommentMessage}`
        : `The testing agent loaded PR and issue review context in dry-run mode. ${attachedIssueMessage}${existingCommentMessage}`,
    sourcePrNumber: input.event.pullRequest.number,
  };
}
