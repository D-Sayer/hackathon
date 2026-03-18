import type {
  AttachedIssueReference,
  PullRequestDiffSnippet,
  TestingPullRequestChangedFile,
} from "./types";

const ATTACHED_ISSUE_REFERENCE_PATTERN =
  /(?:(fix(?:es|ed)?|close(?:s|d)?|resolve(?:s|d)?)\s+)?#(\d+)\b/gi;

function normalizeKeyword(
  keyword: string | undefined,
): AttachedIssueReference["keyword"] {
  if (!keyword) {
    return "reference";
  }

  if (keyword.startsWith("fix")) {
    return "fixes";
  }

  if (keyword.startsWith("close")) {
    return "closes";
  }

  if (keyword.startsWith("resolve")) {
    return "resolves";
  }

  return "reference";
}

function truncatePatch(patch: string, maxLength = 1200): string {
  return patch.length <= maxLength ? patch : `${patch.slice(0, maxLength)}\n...`;
}

export function extractAttachedIssueReferences(params: {
  repository: { name: string; owner: string };
  source: "body" | "title";
  text: string;
}): AttachedIssueReference[] {
  const references: AttachedIssueReference[] = [];

  for (const match of params.text.matchAll(ATTACHED_ISSUE_REFERENCE_PATTERN)) {
    const number = Number.parseInt(match[2] ?? "", 10);

    if (!Number.isInteger(number) || number <= 0) {
      continue;
    }

    references.push({
      keyword: normalizeKeyword(match[1]?.toLowerCase()),
      matchedText: match[0],
      number,
      owner: params.repository.owner,
      repo: params.repository.name,
      source: params.source,
    });
  }

  return references;
}

export function resolveAttachedIssueReference(params: {
  body: string;
  repository: { name: string; owner: string };
  title: string;
}): {
  issueSelectionRationale: string | null;
  reference: AttachedIssueReference | null;
  references: AttachedIssueReference[];
} {
  const references = [
    ...extractAttachedIssueReferences({
      repository: params.repository,
      source: "title",
      text: params.title,
    }),
    ...extractAttachedIssueReferences({
      repository: params.repository,
      source: "body",
      text: params.body,
    }),
  ];

  if (references.length === 0) {
    return {
      issueSelectionRationale: null,
      reference: null,
      references,
    };
  }

  const reference = references[0]!;

  if (references.length === 1) {
    return {
      issueSelectionRationale: `Selected issue #${reference.number} from the ${reference.source}.`,
      reference,
      references,
    };
  }

  const orderedReferences = references.map((item) => `#${item.number}`).join(", ");

  return {
    issueSelectionRationale:
      `Selected issue #${reference.number} from the ${reference.source} as the first resolvable reference. ` +
      `All parsed references: ${orderedReferences}.`,
    reference,
    references,
  };
}

export function selectReviewDiffSnippets(
  changedFiles: TestingPullRequestChangedFile[],
): PullRequestDiffSnippet[] {
  return changedFiles
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
