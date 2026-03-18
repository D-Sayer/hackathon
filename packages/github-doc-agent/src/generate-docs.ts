import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import type { LanguageModel } from "ai";
import { z } from "zod";

import { DOCS_WRITE_TARGET } from "./constants";
import type {
  DocsPageLoader,
  DocsPageTarget,
  GeneratedDocsResult,
  GeneratedDocWriterDraft,
  GeneratedDocWriterInput,
  GeneratedDocFileOperation,
  PullRequestClassification,
  PullRequestClassificationContext,
  PullRequestDiffSnippet,
  PullRequestDocWriter,
  RepositoryDocsPage,
  NormalizedPullRequestWebhookEvent,
} from "./types";

const generatedDocsSchema = z.object({
  drafts: z.array(
    z.object({
      content: z.string().min(1),
      description: z.string().min(1),
      path: z.string().min(1),
      title: z.string().min(1),
    }),
  ),
});

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimDocRootPrefix(value: string): string {
  const normalized = normalizeSlashes(value).replace(/^\.\/+/, "");

  if (normalized === DOCS_WRITE_TARGET) {
    return "";
  }

  if (normalized.startsWith(`${DOCS_WRITE_TARGET}/`)) {
    return normalized.slice(DOCS_WRITE_TARGET.length + 1);
  }

  return normalized;
}

function slugifySegment(value: string): string {
  return value
    .replace(/\.mdx?$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function sanitizeTargetPath(rawPath: string, fallbackSegment: string): string {
  const segments = trimDocRootPrefix(rawPath)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(slugifySegment)
    .filter(Boolean);

  const sanitizedSegments =
    segments.length > 0
      ? segments
      : [slugifySegment(fallbackSegment) || "update"];

  return `${sanitizedSegments.join("/")}.mdx`;
}

function ensureSupportedDocPath(docPath: string): string {
  const normalized = trimDocRootPrefix(docPath).trim();

  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.includes("..\\") ||
    /^[a-z]:/i.test(normalized)
  ) {
    throw new Error(
      `Generated doc path is outside the allowed docs root: ${docPath}`,
    );
  }

  if (!normalized.endsWith(".mdx")) {
    throw new Error(
      `Generated doc path must use an .mdx extension inside ${DOCS_WRITE_TARGET}: ${docPath}`,
    );
  }

  return normalized;
}

function pathWithoutExtension(docPath: string): string {
  return docPath.replace(/\.mdx$/i, "");
}

function pathLookupKeys(docPath: string): string[] {
  const normalized = pathWithoutExtension(trimDocRootPrefix(docPath));
  const keys = new Set<string>([normalized]);

  if (normalized.endsWith("/index")) {
    keys.add(normalized.slice(0, -"/index".length));
  }

  const segments = normalized.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  if (lastSegment) {
    keys.add(lastSegment);
  }

  return [...keys].filter(Boolean);
}

function humanizeSlug(value: string): string {
  return value
    .split(/[/-]+/)
    .filter(Boolean)
    .map((segment) =>
      segment.length === 0
        ? segment
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`,
    )
    .join(" ");
}

function buildFallbackTargetPage(params: {
  classification: PullRequestClassification;
  event: NormalizedPullRequestWebhookEvent;
}): string {
  const preferredSource =
    params.classification.targetPages[0] ??
    params.classification.proposedChanges[0] ??
    params.event.pullRequest.title;

  return sanitizeTargetPath(
    preferredSource,
    `pr-${params.event.pullRequest.number}`,
  );
}

function resolveDocsPageTargets(params: {
  classification: PullRequestClassification;
  docsPages: RepositoryDocsPage[];
  event: NormalizedPullRequestWebhookEvent;
}): DocsPageTarget[] {
  const existingByKey = new Map<string, RepositoryDocsPage[]>();

  for (const page of params.docsPages) {
    for (const key of pathLookupKeys(page.path)) {
      const current = existingByKey.get(key) ?? [];
      current.push(page);
      existingByKey.set(key, current);
    }
  }

  const requestedTargets =
    params.classification.targetPages.length > 0
      ? params.classification.targetPages.map((targetPage) =>
          sanitizeTargetPath(
            targetPage,
            `pr-${params.event.pullRequest.number}`,
          ),
        )
      : [buildFallbackTargetPage(params)];

  const resolvedTargets: DocsPageTarget[] = [];
  const seenPaths = new Set<string>();

  for (const requestedTarget of requestedTargets) {
    const normalizedTarget = ensureSupportedDocPath(requestedTarget);
    const candidatePages = pathLookupKeys(normalizedTarget).flatMap(
      (lookupKey) => existingByKey.get(lookupKey) ?? [],
    );
    const uniqueCandidatePages = [
      ...new Map(candidatePages.map((page) => [page.path, page])).values(),
    ];
    const exactMatch = params.docsPages.find(
      (page) => trimDocRootPrefix(page.path) === normalizedTarget,
    );

    const matchedPage =
      exactMatch ??
      (uniqueCandidatePages.length === 1 ? uniqueCandidatePages[0] : null);
    const targetPath = matchedPage
      ? ensureSupportedDocPath(trimDocRootPrefix(matchedPage.path))
      : normalizedTarget;

    if (seenPaths.has(targetPath)) {
      continue;
    }

    seenPaths.add(targetPath);
    resolvedTargets.push({
      existingContent: matchedPage?.content ?? null,
      matchType: matchedPage
        ? exactMatch
          ? "existing_exact"
          : "existing_unique"
        : "created_new",
      operation: matchedPage ? "update" : "create",
      path: targetPath,
      requestedTarget: normalizedTarget,
    });
  }

  return resolvedTargets.sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function collectDiffSnippets(
  context: PullRequestClassificationContext,
): PullRequestDiffSnippet[] {
  return context.changedFiles
    .filter((file) => Boolean(file.patch))
    .slice(0, 6)
    .map((file) => ({
      path: file.path,
      snippet: file.patch?.slice(0, 1200) ?? "",
    }));
}

function escapeYamlString(value: string): string {
  return JSON.stringify(value.trim());
}

function renderFrontmatter(params: {
  description: string;
  title: string;
}): string {
  return [
    "---",
    `title: ${escapeYamlString(params.title)}`,
    `description: ${escapeYamlString(params.description)}`,
    "---",
  ].join("\n");
}

function parseFrontmatter(content: string): {
  body: string;
  frontmatter: string | null;
} {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n*/);

  if (!match) {
    return {
      body: normalized.trim(),
      frontmatter: null,
    };
  }

  return {
    body: normalized.slice(match[0].length).trim(),
    frontmatter: match[0].trim(),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertGeneratedSection(params: {
  body: string;
  heading: string;
  sectionBody: string;
}): string {
  const normalizedBody = params.body.trim();
  const nextSection =
    `${params.heading}\n\n${params.sectionBody.trim()}`.trim();
  const pattern = new RegExp(
    `(^|\\n)${escapeRegExp(params.heading)}\\n[\\s\\S]*?(?=\\n## |\\n# |$)`,
    "m",
  );

  if (pattern.test(normalizedBody)) {
    return normalizedBody
      .replace(pattern, (_match, prefix: string) => `${prefix}${nextSection}`)
      .trim();
  }

  return normalizedBody.length > 0
    ? `${normalizedBody}\n\n${nextSection}`
    : nextSection;
}

function renderCreateDocument(draft: GeneratedDocWriterDraft): string {
  return `${renderFrontmatter({
    description: draft.description,
    title: draft.title,
  })}\n\n${draft.content.trim()}\n`;
}

function renderUpdateDocument(params: {
  draft: GeneratedDocWriterDraft;
  event: NormalizedPullRequestWebhookEvent;
  existingContent: string;
}): string {
  const existingDocument = parseFrontmatter(params.existingContent);
  const stableHeading = `## PR #${params.event.pullRequest.number} Documentation Update`;
  const sectionIntro = `Source PR: [#${params.event.pullRequest.number}](${params.event.pullRequest.htmlUrl}) - ${params.event.pullRequest.title}`;
  const mergedBody = upsertGeneratedSection({
    body: existingDocument.body,
    heading: stableHeading,
    sectionBody: `${sectionIntro}\n\n${params.draft.content.trim()}`,
  });

  const frontmatter =
    existingDocument.frontmatter ??
    renderFrontmatter({
      description: params.draft.description,
      title: params.draft.title,
    });

  return `${frontmatter}\n\n${mergedBody}\n`;
}

function validateRenderedMdxContent(params: {
  content: string;
  path: string;
}): void {
  const normalized = params.content.replace(/\r\n/g, "\n").trim();
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);

  if (!match) {
    throw new Error(
      `Generated content for ${params.path} must include frontmatter and a body.`,
    );
  }

  const body = match[2]!.trim();

  if (body.length === 0) {
    throw new Error(
      `Generated content for ${params.path} must include MDX body content.`,
    );
  }
}

function buildPatchSummary(operation: GeneratedDocFileOperation): string {
  const previousLines =
    operation.previousContent?.replace(/\r\n/g, "\n").split("\n").length ?? 0;
  const nextLines = operation.content.replace(/\r\n/g, "\n").split("\n").length;
  const delta = nextLines - previousLines;
  const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

  return `${operation.type === "create" ? "Create" : "Update"} ${operation.path} (${deltaLabel} lines)`;
}

function buildDefaultDraft(params: {
  classification: PullRequestClassification;
  context: PullRequestClassificationContext;
  event: NormalizedPullRequestWebhookEvent;
  target: DocsPageTarget;
}): GeneratedDocWriterDraft {
  const baseTitle =
    params.target.operation === "create"
      ? humanizeSlug(
          pathWithoutExtension(params.target.path).split("/").at(-1) ??
            "Update",
        )
      : `PR #${params.event.pullRequest.number} Documentation Update`;
  const overview = params.classification.rationale.trim();
  const proposedChanges =
    params.classification.proposedChanges.length > 0
      ? params.classification.proposedChanges
      : [
          "Review the source PR and document the user-facing impact in this page.",
        ];
  const changedFiles = params.context.changedFiles
    .slice(0, 5)
    .map((file) => `- \`${file.path}\``)
    .join("\n");
  const content =
    params.target.operation === "create"
      ? [
          "## Overview",
          overview,
          "",
          "## What Changed",
          ...proposedChanges.map((change) => `- ${change}`),
          "",
          "## Source Pull Request",
          `- PR: [#${params.event.pullRequest.number}](${params.event.pullRequest.htmlUrl})`,
          `- Title: ${params.event.pullRequest.title}`,
          "",
          "## Relevant Files",
          changedFiles || "- None provided",
        ].join("\n")
      : [
          overview,
          "",
          "### What Changed",
          ...proposedChanges.map((change) => `- ${change}`),
          "",
          "### Relevant Files",
          changedFiles || "- None provided",
        ].join("\n");

  return {
    content,
    description:
      params.classification.rationale.length > 140
        ? `${params.classification.rationale.slice(0, 137).trimEnd()}...`
        : params.classification.rationale,
    path: params.target.path,
    title: baseTitle,
  };
}

export function createDeterministicPullRequestDocWriter(): PullRequestDocWriter {
  return async (input) =>
    input.targets.map((target) =>
      buildDefaultDraft({
        classification: input.classification,
        context: input.context,
        event: input.event,
        target,
      }),
    );
}

function formatChangedFilesForPrompt(
  context: PullRequestClassificationContext,
): string {
  return context.changedFiles.length === 0
    ? "- none"
    : context.changedFiles
        .map(
          (file) =>
            `- ${file.path} (${file.changeType}, +${file.additions}/-${file.deletions})`,
        )
        .join("\n");
}

function formatDocsTargetsForPrompt(targets: DocsPageTarget[]): string {
  return targets
    .map((target) =>
      [
        `Path: ${target.path}`,
        `Operation: ${target.operation}`,
        `Matched: ${target.matchType}`,
        target.existingContent
          ? `Existing content:\n\`\`\`mdx\n${target.existingContent}\n\`\`\``
          : "Existing content: (none)",
      ].join("\n"),
    )
    .join("\n\n");
}

function formatDiffSnippetsForPrompt(
  diffSnippets: PullRequestDiffSnippet[],
): string {
  return diffSnippets.length === 0
    ? "No diff snippets were available."
    : diffSnippets
        .map(
          (snippet) =>
            `File: ${snippet.path}\n\`\`\`diff\n${snippet.snippet}\n\`\`\``,
        )
        .join("\n\n");
}

export function createAiPullRequestDocWriter(params: {
  model: LanguageModel;
}): PullRequestDocWriter {
  return async (input) => {
    const { generateObject } = await import("ai");
    const result = await generateObject({
      model: params.model,
      schema: generatedDocsSchema,
      schemaName: "pull_request_docs_generation",
      schemaDescription:
        "Structured documentation drafts for safe Fumadocs MDX file operations.",
      system: [
        "You write repository-specific Fumadocs documentation updates.",
        `Only target files under ${input.docsWriteTarget}.`,
        "Return one draft per provided target path.",
        "All draft paths must match one of the provided targets and must use the .mdx extension.",
        "For create operations, return a full MDX body without frontmatter.",
        "For update operations, return only the section content to append under a stable PR heading.",
        "Write concrete, repo-specific documentation and avoid generic marketing language.",
        "Use the existing button docs as the canonical example for tone, structure, and depth.",
        "Follow the documentation pattern shown in apps/fumadocs/content/docs/button.mdx and the supporting demo component pattern shown in apps/fumadocs/src/components/docs/button-docs.tsx.",
        "When documenting components, prefer the same style of authoring: practical overview, usage guidance, clear headings, API detail, and references to concrete demo/example components when appropriate.",
      ].join(" "),
      prompt: [
        `PR title: ${input.event.pullRequest.title}`,
        `PR body:\n${input.event.pullRequest.body || "(empty)"}`,
        `Classification rationale: ${input.classification.rationale}`,
        `Proposed changes:\n${input.classification.proposedChanges.map((change) => `- ${change}`).join("\n") || "- none"}`,
        "Changed files:",
        formatChangedFilesForPrompt(input.context),
        "Selected diff snippets:",
        formatDiffSnippetsForPrompt(input.diffSnippets),
        "Resolved documentation targets:",
        formatDocsTargetsForPrompt(input.targets),
        "Canonical documentation example (apps/fumadocs/content/docs/button.mdx):",
        [
          "Use this page as the baseline example for the generated doc's writing style and structure.",
          "Expected patterns include:",
          "- short introductory overview",
          "- sections like when to use, sizes/states/variants/api/usage guidance where relevant",
          "- concrete guidance instead of placeholder copy",
          "- embedded demo components when the repo already exposes them",
        ].join("\n"),
        "Canonical demo component example (apps/fumadocs/src/components/docs/button-docs.tsx):",
        [
          "Use this file as the baseline example for how supporting docs demo components are organized.",
          "Expected patterns include:",
          "- small focused demo components",
          "- descriptive DemoFrame titles and descriptions",
          "- an exported API table component when relevant",
          "- examples grounded in the real component API",
        ].join("\n"),
      ].join("\n\n"),
    });

    return result.object.drafts;
  };
}

async function findDocsRootPath(params: {
  cwd: string;
  docsWriteTarget: string;
}): Promise<string> {
  let current = resolve(params.cwd);

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, params.docsWriteTarget);

    try {
      const candidateStats = await stat(candidate);

      if (candidateStats.isDirectory()) {
        return candidate;
      }
    } catch {
      // Keep walking up until the repo root is found.
    }

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error(
    `Unable to locate docs root "${params.docsWriteTarget}" from ${params.cwd}.`,
  );
}

async function walkDocsPages(
  rootPath: string,
  currentPath = rootPath,
): Promise<RepositoryDocsPage[]> {
  const entries = await readdir(currentPath, {
    withFileTypes: true,
  });
  const pages: RepositoryDocsPage[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(currentPath, entry.name);

    if (entry.isDirectory()) {
      pages.push(...(await walkDocsPages(rootPath, absolutePath)));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mdx")) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    const relativePath = normalizeSlashes(relative(rootPath, absolutePath));

    pages.push({
      content,
      path: relativePath,
    });
  }

  return pages.sort((left, right) => left.path.localeCompare(right.path));
}

export function createLocalDocsPageLoader(params?: {
  cwd?: string;
}): DocsPageLoader {
  return async ({ docsWriteTarget }) => {
    const docsRootPath = await findDocsRootPath({
      cwd: params?.cwd ?? process.cwd(),
      docsWriteTarget,
    });

    return walkDocsPages(docsRootPath);
  };
}

export async function generatePullRequestDocs(
  input: {
    classification: PullRequestClassification;
    context: PullRequestClassificationContext;
    docsWriteTarget?: typeof DOCS_WRITE_TARGET;
    event: NormalizedPullRequestWebhookEvent;
  },
  dependencies: {
    loadDocsPages?: DocsPageLoader;
    writer?: PullRequestDocWriter;
  } = {},
): Promise<GeneratedDocsResult> {
  if (!input.classification.needsDocs) {
    return {
      operations: [],
      patchSummary: [],
      targets: [],
    };
  }

  const docsWriteTarget = input.docsWriteTarget ?? DOCS_WRITE_TARGET;
  const loadDocsPages =
    dependencies.loadDocsPages ?? createLocalDocsPageLoader();
  const docsPages = await loadDocsPages({
    docsWriteTarget,
  });
  const targets = resolveDocsPageTargets({
    classification: input.classification,
    docsPages,
    event: input.event,
  });
  const writer =
    dependencies.writer ?? createDeterministicPullRequestDocWriter();
  const writerInput: GeneratedDocWriterInput = {
    classification: input.classification,
    context: input.context,
    diffSnippets: collectDiffSnippets(input.context),
    docsPages,
    docsWriteTarget,
    event: input.event,
    targets,
  };
  const drafts = await writer(writerInput);

  if (drafts.length !== targets.length) {
    throw new Error(
      `Doc writer returned ${drafts.length} drafts for ${targets.length} resolved targets.`,
    );
  }

  const targetByPath = new Map(
    targets.map((target) => [ensureSupportedDocPath(target.path), target]),
  );
  const operations: GeneratedDocFileOperation[] = [];
  const seenDraftPaths = new Set<string>();

  for (const draft of drafts) {
    const normalizedPath = ensureSupportedDocPath(draft.path);
    const target = targetByPath.get(normalizedPath);

    if (!target) {
      throw new Error(
        `Doc writer returned an unexpected target path outside the resolved target set: ${draft.path}`,
      );
    }

    if (seenDraftPaths.has(normalizedPath)) {
      throw new Error(`Doc writer returned duplicate drafts for ${draft.path}`);
    }

    seenDraftPaths.add(normalizedPath);

    const repoRelativePath = `${docsWriteTarget}/${normalizedPath}`;
    const content =
      target.operation === "create"
        ? renderCreateDocument({
            ...draft,
            path: normalizedPath,
          })
        : renderUpdateDocument({
            draft: {
              ...draft,
              path: normalizedPath,
            },
            event: input.event,
            existingContent: target.existingContent ?? "",
          });

    validateRenderedMdxContent({
      content,
      path: repoRelativePath,
    });

    operations.push({
      content,
      path: repoRelativePath,
      previousContent: target.existingContent,
      summary: `${target.operation === "create" ? "Create" : "Update"} ${repoRelativePath}`,
      type: target.operation,
    });
  }

  const orderedOperations = operations.sort((left, right) =>
    left.path.localeCompare(right.path),
  );

  return {
    operations: orderedOperations,
    patchSummary: orderedOperations.map(buildPatchSummary),
    targets,
  };
}
