import type {
  GitHubTestingAgentWorkflowLogEntry,
  GitHubTestingAgentWorkflowResult,
  NormalizedTestingPullRequestWebhookEvent,
} from "./types";

export function createGitHubTestingAgentWorkflowLogEntry(params: {
  event: NormalizedTestingPullRequestWebhookEvent;
  mode: "dry-run" | "live";
  result: GitHubTestingAgentWorkflowResult;
}): GitHubTestingAgentWorkflowLogEntry {
  return {
    accepted: params.result.accepted,
    action: params.event.action,
    analysisShouldComment: params.result.analysis.shouldComment,
    analysisSource: params.result.analysis.source,
    attachedIssueNumber: params.result.context?.attachedIssueNumber ?? null,
    code: params.result.code,
    confidence: params.result.analysis.confidence,
    deliveryId: params.event.deliveryId,
    eventName: params.event.eventName,
    mode: params.mode,
    sourcePrNumber: params.event.pullRequest.number,
    wasModelSkipped: params.result.analysis.wasModelSkipped,
    writebackErrorMessage: params.result.writeback.errorMessage,
    writebackStatus: params.result.writeback.status,
  };
}
