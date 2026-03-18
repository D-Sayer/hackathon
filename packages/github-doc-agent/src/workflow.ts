import { DOCS_WRITE_TARGET } from "./constants";
import {
  evaluatePullRequestHeuristics,
} from "./classify-pr";
import { generatePullRequestDocs } from "./generate-docs";
import type {
  DocsPageLoader,
  GitHubDocAgentWorkflowInput,
  GitHubDocAgentWorkflowResult,
  PullRequestDocWriter,
  PullRequestClassification,
  PullRequestClassificationSource,
  PullRequestClassifier,
  PullRequestContextLoader,
} from "./types";

export interface GitHubDocAgentWorkflowDependencies {
  isConfigured?: boolean;
  classifier?: PullRequestClassifier;
  docWriter?: PullRequestDocWriter;
  loadDocsPages?: DocsPageLoader;
  loadPullRequestContext?: PullRequestContextLoader;
}

function buildWorkflowMessage(params: {
  classification: PullRequestClassification;
  generatedOperationCount: number;
  mode: "dry-run" | "live";
  source: PullRequestClassificationSource;
}): string {
  const prefix =
    params.mode === "live"
      ? "PR classified for docs automation."
      : "PR classified in dry-run mode for docs automation.";

  const decision = params.classification.needsDocs
    ? "Documentation updates are required."
    : "No documentation updates are required.";

  const generation =
    params.generatedOperationCount > 0
      ? ` Planned ${params.generatedOperationCount} documentation file operation${params.generatedOperationCount === 1 ? "" : "s"}.`
      : "";

  return `${prefix} ${decision} Decision source: ${params.source}.${generation}`;
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
      classification: {
        changedFilesConsidered: [],
        needsDocs: false,
        proposedChanges: [],
        rationale:
          "The workflow is not configured, so pull request classification did not run.",
        source: "fallback",
        targetPages: [],
        wasModelSkipped: true,
      },
      docGeneration: null,
      docsWriteTarget: DOCS_WRITE_TARGET,
      message:
        "The docs agent architecture is wired, but GitHub integration is not configured yet.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  if (!dependencies.loadPullRequestContext) {
    return {
      accepted: false,
      code: "workflow_not_configured",
      classification: {
        changedFilesConsidered: [],
        needsDocs: false,
        proposedChanges: [],
        rationale:
          "The workflow cannot classify this pull request because no PR context loader is configured.",
        source: "fallback",
        targetPages: [],
        wasModelSkipped: true,
      },
      docGeneration: null,
      docsWriteTarget: DOCS_WRITE_TARGET,
      message:
        "The docs agent workflow needs a PR context loader before classification can run.",
      sourcePrNumber: input.event.pullRequest.number,
    };
  }

  const context = await dependencies.loadPullRequestContext(input.event);
  const heuristicEvaluation = evaluatePullRequestHeuristics(context);

  let classification: PullRequestClassification;
  let source: PullRequestClassificationSource = heuristicEvaluation.source;
  let wasModelSkipped = heuristicEvaluation.shouldSkipModel;

  if (heuristicEvaluation.shouldSkipModel && heuristicEvaluation.decision) {
    classification = heuristicEvaluation.decision;
  } else if (dependencies.classifier) {
    classification = await dependencies.classifier({
      context,
      diffSnippets: heuristicEvaluation.diffSnippets,
      filteredChangedFiles: heuristicEvaluation.filteredChangedFiles,
    });
    source = "model";
    wasModelSkipped = false;
  } else {
    classification = {
      needsDocs: true,
      proposedChanges: [
        "Review the impacted behavior and capture the user-facing or setup change in Fumadocs.",
      ],
      rationale:
        "Positive docs-impact signals were found, but no AI classifier is configured. Falling back to a conservative docs-needed decision.",
      targetPages: [],
    };
    source = "fallback";
    wasModelSkipped = true;
  }

  let docGeneration: GitHubDocAgentWorkflowResult["docGeneration"] = null;

  if (classification.needsDocs) {
    try {
      docGeneration = await generatePullRequestDocs(
        {
          classification,
          context,
          docsWriteTarget: DOCS_WRITE_TARGET,
          event: input.event,
        },
        {
          loadDocsPages: dependencies.loadDocsPages,
          writer: dependencies.docWriter,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown doc generation error.";

      return {
        accepted: false,
        code: "doc_generation_failed",
        classification: {
          ...classification,
          changedFilesConsidered: heuristicEvaluation.changedFilesConsidered,
          source,
          wasModelSkipped,
        },
        docGeneration: null,
        docsWriteTarget: DOCS_WRITE_TARGET,
        message: `Documentation generation failed after classification: ${message}`,
        sourcePrNumber: input.event.pullRequest.number,
      };
    }
  }

  const code =
    mode === "live"
      ? classification.needsDocs
        ? "classified_needs_docs"
        : "classified_no_docs"
      : "dry_run";

  return {
    accepted: true,
    code,
    classification: {
      ...classification,
      changedFilesConsidered: heuristicEvaluation.changedFilesConsidered,
      source,
      wasModelSkipped,
    },
    docGeneration,
    docsWriteTarget: DOCS_WRITE_TARGET,
    message: buildWorkflowMessage({
      classification,
      generatedOperationCount: docGeneration?.operations.length ?? 0,
      mode,
      source,
    }),
    sourcePrNumber: input.event.pullRequest.number,
  };
}
