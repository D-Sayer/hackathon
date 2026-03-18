import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import type {
  PullRequestDiffSnippet,
  PullRequestReviewAnalysis,
  PullRequestReviewAnalyzer,
  PullRequestReviewContext,
  PullRequestReviewHeuristicEvaluation,
} from "./types";

const reviewAnalysisSchema = z.object({
  shouldComment: z.boolean(),
  summary: z.string().min(1),
  implementationGaps: z.array(z.string()),
  testingNotes: z.array(z.string()),
  blastRadius: z.array(z.string()),
  oversights: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(1),
});

const DOCS_ONLY_PATH_PATTERNS = [
  /^README\.md$/i,
  /(^|\/)README\.md$/i,
  /\.mdx?$/i,
];

const TEST_ONLY_PATH_PATTERNS = [
  /(^|\/)__tests__\//,
  /(^|\/)__fixtures__\//,
  /(^|\/)test(s)?\//,
  /\.test\.[^/]+$/i,
  /\.spec\.[^/]+$/i,
];

const CI_ONLY_PATH_PATTERNS = [
  /^\.github\//,
  /^\.changeset\//,
  /^\.husky\//,
  /^\.vscode\//,
  /^\.idea\//,
  /^\.devcontainer\//,
  /^docker\//,
  /^infra\//,
  /^terraform\//,
  /^\.nvmrc$/i,
  /^\.tool-versions$/i,
];

const FORMATTING_ONLY_PATH_PATTERNS = [
  /^package-lock\.json$/i,
  /^bun\.lock$/i,
  /^pnpm-lock\.yaml$/i,
  /^yarn\.lock$/i,
  /^biome\.json/i,
  /^prettier\.config/i,
  /^eslint\.config/i,
];

const POSITIVE_TEXT_PATTERN =
  /\b(feature|bug|bugfix|fix|behavior|migration|workflow|config|configuration|env|setup|permission|failure|error|ui|ux|api|endpoint|route|webhook)\b/i;

const INTERNAL_ONLY_TEXT_PATTERN =
  /\b(refactor|cleanup|internal|rename|chore|lint|format|reorganize|restructure|typing|types only|no behavior change)\b/i;

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(path));
}

function fileLooksDocsOnly(path: string): boolean {
  return matchesAny(path, DOCS_ONLY_PATH_PATTERNS);
}

function fileLooksTestOnly(path: string): boolean {
  return matchesAny(path, TEST_ONLY_PATH_PATTERNS);
}

function fileLooksCiOnly(path: string): boolean {
  return matchesAny(path, CI_ONLY_PATH_PATTERNS);
}

function fileLooksFormattingOnly(path: string): boolean {
  return matchesAny(path, FORMATTING_ONLY_PATH_PATTERNS);
}

function createHeuristicDecision(params: {
  rationale: string;
  summary: string;
}): PullRequestReviewAnalysis {
  return {
    blastRadius: [],
    confidence: "high",
    implementationGaps: [],
    oversights: [],
    rationale: params.rationale,
    shouldComment: false,
    summary: params.summary,
    testingNotes: [],
  };
}

function formatChangedFiles(paths: string[]): string {
  return paths.length === 0
    ? "- none"
    : paths.map((path) => `- ${path}`).join("\n");
}

function formatDiffSnippets(diffSnippets: PullRequestDiffSnippet[]): string {
  return diffSnippets.length === 0
    ? "No diff snippets were selected."
    : diffSnippets
        .map(
          (snippet) =>
            `File: ${snippet.path}\n\`\`\`diff\n${snippet.snippet}\n\`\`\``,
        )
        .join("\n\n");
}

export function evaluatePullRequestReviewHeuristics(
  context: PullRequestReviewContext,
): PullRequestReviewHeuristicEvaluation {
  const titleBody = `${context.pullRequestTitle}\n${context.pullRequestBody}`.trim();
  const changedPaths = context.changedFiles.map((file) => file.path);
  const relevantFiles = changedPaths.filter((path) =>
    /^(apps\/server\/|apps\/web\/|packages\/)/.test(path),
  );
  const changedFilesConsidered =
    relevantFiles.length > 0 ? relevantFiles : changedPaths.slice(0, 50);
  const diffSnippets = context.diffSnippets.slice(0, 8);

  if (!context.attachedIssue) {
    return {
      changedFilesConsidered,
      decision: createHeuristicDecision({
        rationale:
          "V1 only comments on attached issues, and no attached issue could be loaded for this pull request.",
        summary:
          "No issue feedback comment will be generated because the PR does not resolve a loadable attached issue.",
      }),
      diffSnippets,
      filteredChangedFiles: changedFilesConsidered,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  if (changedPaths.length === 0) {
    return {
      changedFilesConsidered,
      decision: createHeuristicDecision({
        rationale: "The PR does not include any changed files to analyze.",
        summary:
          "No issue feedback comment is needed because the PR has no changed files to review.",
      }),
      diffSnippets,
      filteredChangedFiles: changedFilesConsidered,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  if (changedPaths.every(fileLooksDocsOnly)) {
    return {
      changedFilesConsidered,
      decision: createHeuristicDecision({
        rationale:
          "The PR only changes documentation or markdown content, so there is no implementation review feedback to post back to the issue.",
        summary:
          "No issue feedback comment is needed because the PR is docs-only.",
      }),
      diffSnippets,
      filteredChangedFiles: changedFilesConsidered,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  if (
    changedPaths.every(
      (path) =>
        fileLooksTestOnly(path) ||
        fileLooksCiOnly(path) ||
        fileLooksFormattingOnly(path),
    ) &&
    !POSITIVE_TEXT_PATTERN.test(titleBody)
  ) {
    return {
      changedFilesConsidered,
      decision: createHeuristicDecision({
        rationale:
          "The PR is limited to tests, CI, or formatting-oriented files with no signal that the linked issue scope changed.",
        summary:
          "No issue feedback comment is needed because the PR is limited to non-production changes.",
      }),
      diffSnippets,
      filteredChangedFiles: changedFilesConsidered,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  if (
    INTERNAL_ONLY_TEXT_PATTERN.test(titleBody) &&
    !POSITIVE_TEXT_PATTERN.test(titleBody)
  ) {
    return {
      changedFilesConsidered,
      decision: createHeuristicDecision({
        rationale:
          "The PR is explicitly framed as an internal refactor with no external behavior change, so review feedback would likely be non-actionable.",
        summary:
          "No issue feedback comment is needed because the PR is an internal refactor.",
      }),
      diffSnippets,
      filteredChangedFiles: changedFilesConsidered,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  return {
    changedFilesConsidered,
    diffSnippets,
    filteredChangedFiles: changedFilesConsidered,
    shouldSkipModel: false,
    source: "heuristic",
  };
}

export function createAiPullRequestReviewAnalyzer(params: {
  model: LanguageModel;
}): PullRequestReviewAnalyzer {
  return async ({
    context,
    diffSnippets,
    filteredChangedFiles,
  }): Promise<PullRequestReviewAnalysis> => {
    const result = await generateObject({
      model: params.model,
      schema: reviewAnalysisSchema,
      schemaName: "pull_request_issue_review_analysis",
      schemaDescription:
        "Structured issue follow-up analysis for a source pull request and its attached GitHub issue.",
      system: [
        "You review a GitHub pull request against its attached issue for this monorepo.",
        "The repository has app surfaces under apps/server and apps/web plus shared logic under packages/.",
        "Return concise, actionable issue follow-up notes about implementation completeness, testing coverage gaps, likely blast radius, and oversights.",
        "Compare the pull request intent to the attached issue intent and call out scope mismatches.",
        "Pay special attention to failure paths, permissions, migrations, workflow and configuration changes, and user-facing behavior.",
        "Avoid generic praise, avoid repeating the diff, and use empty arrays when a section has no concrete findings.",
        "Set shouldComment=false only when there is truly no actionable feedback for the attached issue.",
      ].join(" "),
      prompt: [
        `PR title: ${context.pullRequestTitle}`,
        `PR body:\n${context.pullRequestBody || "(empty)"}`,
        `Attached issue title: ${context.attachedIssue?.title ?? "(missing)"}`,
        `Attached issue body:\n${context.attachedIssue?.body || "(empty)"}`,
        `Attached issue state: ${context.attachedIssue?.state ?? "unknown"}`,
        "Changed files:",
        formatChangedFiles(filteredChangedFiles),
        "Selected diff snippets:",
        formatDiffSnippets(diffSnippets),
        "Return concise findings that would be useful in a short GitHub issue comment.",
      ].join("\n\n"),
    });

    return result.object;
  };
}
