import { DOCS_WRITE_TARGET } from "./constants";
import type {
  GitHubDocAgentWorkflowInput,
  GitHubDocAgentWorkflowResult,
} from "./types";

export interface GitHubDocAgentWorkflowDependencies {
  isConfigured?: boolean;
}

export async function runGitHubDocAgentWorkflow(
  input: GitHubDocAgentWorkflowInput,
  dependencies: GitHubDocAgentWorkflowDependencies = {},
): Promise<GitHubDocAgentWorkflowResult> {
  const mode = input.mode ?? "dry-run";

  if (dependencies.isConfigured === false) {
    return {
      accepted: false,
      code: "workflow_not_configured",
      docsWriteTarget: DOCS_WRITE_TARGET,
      message:
        "The docs agent architecture is wired, but GitHub integration is not configured yet.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  return {
    accepted: true,
    code: mode === "live" ? "accepted" : "dry_run",
    docsWriteTarget: DOCS_WRITE_TARGET,
    message:
      mode === "live"
        ? "Webhook accepted by the docs agent workflow skeleton."
        : "Webhook accepted in dry-run mode by the docs agent workflow skeleton.",
    sourcePrNumber: input.event.pullRequest.number,
  };
}
