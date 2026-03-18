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
    code: params.result.code,
    deliveryId: params.event.deliveryId,
    eventName: params.event.eventName,
    mode: params.mode,
    sourcePrNumber: params.event.pullRequest.number,
  };
}
