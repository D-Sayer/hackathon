import type { LanguageModel } from "ai";
import { z } from "zod";

import { DOCS_WRITE_TARGET } from "./constants";
import type {
  PullRequestClassification,
  PullRequestClassificationContext,
  PullRequestClassifier,
  PullRequestDiffSnippet,
  PullRequestHeuristicEvaluation,
} from "./types";

const docsClassificationSchema = z.object({
  needsDocs: z.boolean(),
  rationale: z.string().min(1),
  targetPages: z.array(z.string()),
  proposedChanges: z.array(z.string()),
});

const DOCS_ONLY_PATH_PATTERNS = [
  /^apps\/fumadocs\/content\/docs\//,
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
  /\b(feature|api|endpoint|route|workflow|ux|ui|setup|install|config|configuration|env|breaking|migration|authentication|authorization|login|signup|dashboard|webhook)\b/i;

const INTERNAL_ONLY_TEXT_PATTERN =
  /\b(refactor|cleanup|internal|rename|chore|lint|format|reorganize|restructure|typing|types only)\b/i;

function truncatePatch(patch: string, maxLength = 1200): string {
  return patch.length <= maxLength ? patch : `${patch.slice(0, maxLength)}\n...`;
}

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

function selectDiffSnippets(
  context: PullRequestClassificationContext,
): PullRequestDiffSnippet[] {
  return context.changedFiles
    .filter(
      (file) =>
        Boolean(file.patch) &&
        (file.path.startsWith("apps/server/") ||
          file.path.startsWith("apps/web/") ||
          file.path.startsWith("packages/")),
    )
    .slice(0, 8)
    .map((file) => ({
      path: file.path,
      snippet: truncatePatch(file.patch ?? ""),
    }));
}

export function evaluatePullRequestHeuristics(
  context: PullRequestClassificationContext,
): PullRequestHeuristicEvaluation {
  const titleBody = `${context.title}\n${context.body}`.trim();
  const changedPaths = context.changedFiles.map((file) => file.path);
  const relevantFiles = changedPaths.filter((path) =>
    /^(apps\/server\/|apps\/web\/|packages\/)/.test(path),
  );
  const diffSnippets = selectDiffSnippets(context);

  if (changedPaths.length === 0) {
    return {
      changedFilesConsidered: relevantFiles,
      decision: {
        needsDocs: false,
        proposedChanges: [],
        rationale: "The PR does not include any changed files to classify.",
        targetPages: [],
      },
      diffSnippets,
      filteredChangedFiles: relevantFiles,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  if (changedPaths.every(fileLooksDocsOnly)) {
    return {
      changedFilesConsidered: relevantFiles,
      decision: {
        needsDocs: false,
        proposedChanges: [],
        rationale:
          "The PR only changes documentation pages or markdown content, so it should not open a separate docs PR.",
        targetPages: [],
      },
      diffSnippets,
      filteredChangedFiles: relevantFiles,
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
      changedFilesConsidered: relevantFiles,
      decision: {
        needsDocs: false,
        proposedChanges: [],
        rationale:
          "The PR is limited to tests, CI, or formatting-oriented files with no user-facing signal in the title or body.",
        targetPages: [],
      },
      diffSnippets,
      filteredChangedFiles: relevantFiles,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  if (
    INTERNAL_ONLY_TEXT_PATTERN.test(titleBody) &&
    !POSITIVE_TEXT_PATTERN.test(titleBody)
  ) {
    return {
      changedFilesConsidered: relevantFiles,
      decision: {
        needsDocs: false,
        proposedChanges: [],
        rationale:
          "The PR is explicitly described as an internal refactor with no behavior change, so it does not require documentation updates.",
        targetPages: [],
      },
      diffSnippets,
      filteredChangedFiles: relevantFiles,
      shouldSkipModel: true,
      source: "heuristic",
    };
  }

  return {
    changedFilesConsidered: relevantFiles,
    diffSnippets,
    filteredChangedFiles:
      relevantFiles.length > 0 ? relevantFiles : changedPaths.slice(0, 50),
    shouldSkipModel: false,
    source: "heuristic",
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

export function createAiPullRequestClassifier(params: {
  model: LanguageModel;
}): PullRequestClassifier {
  return async ({
    context,
    diffSnippets,
    filteredChangedFiles,
  }): Promise<PullRequestClassification> => {
    const { generateObject } = await import("ai");
    const result = await generateObject({
      model: params.model,
      schema: docsClassificationSchema,
      schemaName: "pull_request_docs_classification",
      schemaDescription:
        "Whether a source pull request needs Fumadocs documentation updates in this repository.",
      system: [
        "You classify whether a GitHub pull request needs documentation updates.",
        `Documentation scope is limited to ${DOCS_WRITE_TARGET}.`,
        "Docs are needed for user-facing, developer-facing, setup, workflow, configuration, API, UX, or concept changes.",
        "Docs are not needed for docs-only changes, test-only changes, CI-only changes, formatting-only changes, or internal refactors with no externally visible behavior change.",
        "Prefer a conservative bias toward needsDocs=true when real behavior changed but target page selection is imperfect.",
      ].join(" "),
      prompt: [
        `PR title: ${context.title}`,
        `PR body:\n${context.body || "(empty)"}`,
        `Labels: ${context.labels.length > 0 ? context.labels.join(", ") : "(none)"}`,
        "Changed files:",
        formatChangedFiles(filteredChangedFiles),
        "Selected diff snippets:",
        formatDiffSnippets(diffSnippets),
        "Return concise rationale and actionable proposedChanges.",
      ].join("\n\n"),
    });

    return result.object;
  };
}
