import type {
  GitHubDocAgentWorkflowLogEntry,
  GitHubDocAgentWorkflowResult,
  NormalizedPullRequestWebhookEvent,
} from "./types";

export function createGitHubDocAgentWorkflowLogEntry(params: {
  event: NormalizedPullRequestWebhookEvent;
  mode: "dry-run" | "live";
  result: GitHubDocAgentWorkflowResult;
}): GitHubDocAgentWorkflowLogEntry {
  return {
    accepted: params.result.accepted,
    action: params.event.action,
    classifierOutcome: params.result.classification.needsDocs
      ? "needs_docs"
      : "no_docs",
    classifierSource: params.result.classification.source,
    code: params.result.code,
    deliveryId: params.event.deliveryId,
    docsPrAction: params.result.writeback?.pullRequest?.action ?? null,
    docsPrNumber: params.result.writeback?.pullRequest?.number ?? null,
    docsWriteTarget: params.result.docsWriteTarget,
    eventName: params.event.eventName,
    generatedOperationCount: params.result.docGeneration?.operations.length ?? 0,
    mode: params.mode,
    sourcePrNumber: params.result.sourcePrNumber,
    wasModelSkipped: params.result.classification.wasModelSkipped,
    writebackStatus: params.result.writeback?.status ?? null,
  };
}
