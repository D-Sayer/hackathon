import type {
  GitHubTestingAgentWorkflowInput,
  GitHubTestingAgentWorkflowResult,
} from "./types";

export interface GitHubTestingAgentWorkflowDependencies {
  isConfigured?: boolean;
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
      message:
        "The testing agent intake is wired, but the workflow is not enabled yet.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  return {
    accepted: true,
    code: mode === "live" ? "accepted" : "dry_run",
    message:
      mode === "live"
        ? "The testing agent accepted the pull request webhook. Later slices will load PR and issue context."
        : "The testing agent accepted the pull request webhook in dry-run mode. Later slices will load PR and issue context.",
    sourcePrNumber: input.event.pullRequest.number,
  };
}
