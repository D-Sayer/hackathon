import type {
  ExistingIssueFeedbackComment,
  IssueFeedbackCommentRenderer,
  PullRequestReviewAnalysis,
} from "./types";

const DEFAULT_AGENT_IDENTITY = "github-testing-agent";

function escapeHtmlCommentValue(value: string): string {
  return value.replace(/-->/g, "--&gt;");
}

function renderSection(title: string, entries: string[]): string {
  const content =
    entries.length === 0
      ? "- None noted."
      : entries.map((entry) => `- ${entry}`).join("\n");

  return `## ${title}\n${content}`;
}

export function createIssueFeedbackCommentMarker(params: {
  agentIdentity?: string;
  sourcePrNumber: number;
}): string {
  const agentIdentity = escapeHtmlCommentValue(
    params.agentIdentity ?? DEFAULT_AGENT_IDENTITY,
  );

  return `<!-- github-testing-agent:agent=${agentIdentity};source-pr-number=${params.sourcePrNumber} -->`;
}

export function findMatchingIssueFeedbackComment(params: {
  agentIdentity?: string;
  comments: ExistingIssueFeedbackComment[];
  sourcePrNumber: number;
  sourcePrUrl: string;
}): ExistingIssueFeedbackComment | null {
  const marker = createIssueFeedbackCommentMarker({
    agentIdentity: params.agentIdentity,
    sourcePrNumber: params.sourcePrNumber,
  });
  const legacyMarkerByNumber =
    `<!-- github-testing-agent:source-pr-number=${params.sourcePrNumber} -->`;
  const legacyMarkerByUrl =
    `<!-- github-testing-agent:source-pr-url=${params.sourcePrUrl} -->`;

  for (const comment of params.comments) {
    if (
      comment.body.includes(marker) ||
      comment.body.includes(legacyMarkerByNumber) ||
      comment.body.includes(legacyMarkerByUrl) ||
      comment.body.includes(params.sourcePrUrl)
    ) {
      return comment;
    }
  }

  return null;
}

export const renderIssueFeedbackComment: IssueFeedbackCommentRenderer = ({
  agentIdentity,
  analysis,
  attachedIssue,
  sourcePullRequest,
}) => {
  const marker = createIssueFeedbackCommentMarker({
    agentIdentity,
    sourcePrNumber: sourcePullRequest.number,
  });
  const sections = [
    marker,
    "## Summary",
    analysis.summary,
    renderSection("Implementation Gaps", analysis.implementationGaps),
    renderSection("Testing Notes", analysis.testingNotes),
    renderSection("Blast Radius", analysis.blastRadius),
    renderSection("Oversights", analysis.oversights),
    "## Source Pull Request",
    `- [#${sourcePullRequest.number} ${sourcePullRequest.title}](${sourcePullRequest.htmlUrl})`,
    `- Attached issue: [#${attachedIssue.number} ${attachedIssue.title}](${attachedIssue.htmlUrl})`,
    `- Confidence: ${analysis.confidence}`,
    "",
    `_Rationale: ${analysis.rationale}_`,
  ];

  return {
    body: sections.join("\n"),
    marker,
  };
};

export function createSkippedWritebackResult(
  status: "dry_run" | "not_needed" | "skipped",
  renderedBody: string | null,
): {
  commentId: number | null;
  errorMessage: string | null;
  renderedBody: string | null;
  status: "dry_run" | "not_needed" | "skipped";
} {
  return {
    commentId: null,
    errorMessage: null,
    renderedBody,
    status,
  };
}
