import type { PullRequestReviewContext } from "../types";

function createReviewContext(
  partial: Partial<PullRequestReviewContext>,
): PullRequestReviewContext {
  return {
    attachedIssue: {
      body: "Implement review analysis and capture issue follow-up from pull requests.",
      htmlUrl: "https://github.com/acme/repo/issues/123",
      number: 123,
      state: "open",
      title: "Track review analysis feedback on linked issues",
    },
    attachedIssueReference: {
      keyword: "fixes",
      matchedText: "Fixes #123",
      number: 123,
      owner: "acme",
      repo: "repo",
      source: "body",
    },
    changedFiles: [],
    diffSnippets: [],
    existingFeedbackComment: null,
    issueSelectionRationale: "Selected issue #123 from the body.",
    pullRequestBody: "Fixes #123",
    pullRequestTitle: "Update testing agent workflow",
    ...partial,
  };
}

export const featureReviewContextFixture = createReviewContext({
  attachedIssue: {
    body:
      "When a source PR references an issue, analyze the implementation and testing gaps before writing back a stable issue comment.",
    htmlUrl: "https://github.com/acme/repo/issues/123",
    number: 123,
    state: "open",
    title: "Add issue review analysis to the testing agent",
  },
  changedFiles: [
    {
      additions: 64,
      changeType: "modified",
      deletions: 12,
      path: "packages/github-testing-agent/src/workflow.ts",
      patch:
        "@@ -10,4 +10,20 @@\n+const analysis = await analyzePullRequest();\n+return renderIssueComment(analysis);\n",
      previousPath: null,
    },
    {
      additions: 22,
      changeType: "modified",
      deletions: 4,
      path: "apps/server/src/app.ts",
      patch:
        "@@ -40,2 +40,10 @@\n+runGitHubTestingAgentWorkflow({ analyzer });\n",
      previousPath: null,
    },
    {
      additions: 18,
      changeType: "modified",
      deletions: 0,
      path: "packages/github-testing-agent/src/workflow.test.ts",
      patch:
        "@@ -1,2 +1,12 @@\n+test('returns structured analysis', async () => {});\n",
      previousPath: null,
    },
  ],
  diffSnippets: [
    {
      path: "packages/github-testing-agent/src/workflow.ts",
      snippet:
        "@@ -10,4 +10,20 @@\n+const analysis = await analyzePullRequest();\n+return renderIssueComment(analysis);\n",
    },
    {
      path: "apps/server/src/app.ts",
      snippet:
        "@@ -40,2 +40,10 @@\n+runGitHubTestingAgentWorkflow({ analyzer });\n",
    },
  ],
  pullRequestBody:
    "Fixes #123\n\nAdds structured review analysis before the testing agent writes back to the linked issue.",
  pullRequestTitle: "Add testing-agent review analysis",
});

export const partialBugfixReviewContextFixture = createReviewContext({
  attachedIssue: {
    body:
      "Fix the webhook replay failure so invalid payloads return a structured error and retries do not duplicate comments.",
    htmlUrl: "https://github.com/acme/repo/issues/124",
    number: 124,
    state: "open",
    title: "Fix webhook replay failure handling",
  },
  attachedIssueReference: {
    keyword: "fixes",
    matchedText: "Fixes #124",
    number: 124,
    owner: "acme",
    repo: "repo",
    source: "body",
  },
  changedFiles: [
    {
      additions: 16,
      changeType: "modified",
      deletions: 4,
      path: "apps/server/src/app.ts",
      patch:
        "@@ -120,2 +120,8 @@\n+return c.json({ code: 'invalid_payload' }, 400);\n",
      previousPath: null,
    },
    {
      additions: 8,
      changeType: "modified",
      deletions: 0,
      path: "packages/github-testing-agent/src/workflow.test.ts",
      patch: "@@ -30,2 +30,8 @@\n+expect(result.code).toBe('dry_run');\n",
      previousPath: null,
    },
  ],
  diffSnippets: [
    {
      path: "apps/server/src/app.ts",
      snippet:
        "@@ -120,2 +120,8 @@\n+return c.json({ code: 'invalid_payload' }, 400);\n",
    },
  ],
  pullRequestBody:
    "Fixes #124\n\nReturns a structured error when webhook payload parsing fails.",
  pullRequestTitle: "Fix invalid payload handling for GitHub webhook intake",
});

export const internalRefactorReviewContextFixture = createReviewContext({
  changedFiles: [
    {
      additions: 18,
      changeType: "modified",
      deletions: 18,
      path: "packages/github-testing-agent/src/context.ts",
      patch:
        "@@ -5,8 +5,8 @@\n-export const oldHelper = () => {}\n+export const reviewContextHelper = () => {}\n",
      previousPath: null,
    },
  ],
  diffSnippets: [
    {
      path: "packages/github-testing-agent/src/context.ts",
      snippet:
        "@@ -5,8 +5,8 @@\n-export const oldHelper = () => {}\n+export const reviewContextHelper = () => {}\n",
    },
  ],
  pullRequestBody: "Cleanup only. Internal-only change with no user-facing impact intended.",
  pullRequestTitle: "Internal refactor of testing agent context helpers",
});

export const docsOnlyReviewContextFixture = createReviewContext({
  changedFiles: [
    {
      additions: 12,
      changeType: "modified",
      deletions: 5,
      path: "README.md",
      patch: "@@ -1,2 +1,2 @@\n-Old intro\n+New intro\n",
      previousPath: null,
    },
    {
      additions: 8,
      changeType: "modified",
      deletions: 3,
      path: "plans/testing-agent/05-review-classification-and-analysis.md",
      patch: "@@ -1,2 +1,6 @@\n+Clarify the analysis plan.\n",
      previousPath: null,
    },
  ],
  diffSnippets: [],
  pullRequestBody: "Refreshes documentation and planning notes only.",
  pullRequestTitle: "Improve testing-agent docs wording",
});

export const configChangeReviewContextFixture = createReviewContext({
  attachedIssue: {
    body:
      "Add the environment and operational setup needed to safely run the testing agent in production.",
    htmlUrl: "https://github.com/acme/repo/issues/125",
    number: 125,
    state: "open",
    title: "Configure testing agent rollout settings",
  },
  attachedIssueReference: {
    keyword: "fixes",
    matchedText: "Fixes #125",
    number: 125,
    owner: "acme",
    repo: "repo",
    source: "body",
  },
  changedFiles: [
    {
      additions: 10,
      changeType: "modified",
      deletions: 0,
      path: "packages/env/src/server.ts",
      patch:
        "@@ -20,2 +20,8 @@\n+TESTING_AGENT_MODEL: z.string().optional(),\n+GITHUB_TESTING_AGENT_MODE: z.enum(['dry-run', 'live']),\n",
      previousPath: null,
    },
    {
      additions: 8,
      changeType: "modified",
      deletions: 1,
      path: "apps/server/.env.example",
      patch:
        "@@ -1,2 +1,6 @@\n+TESTING_AGENT_MODEL=gpt-4.1-mini\n+GITHUB_TESTING_AGENT_MODE=dry-run\n",
      previousPath: null,
    },
  ],
  diffSnippets: [
    {
      path: "packages/env/src/server.ts",
      snippet:
        "@@ -20,2 +20,8 @@\n+TESTING_AGENT_MODEL: z.string().optional(),\n+GITHUB_TESTING_AGENT_MODE: z.enum(['dry-run', 'live']),\n",
    },
  ],
  pullRequestBody:
    "Fixes #125\n\nAdds the config and env wiring required to run the testing agent safely.",
  pullRequestTitle: "Add testing-agent configuration and rollout flags",
});

export const noAttachedIssueReviewContextFixture = createReviewContext({
  attachedIssue: null,
  attachedIssueReference: null,
  changedFiles: [
    {
      additions: 28,
      changeType: "modified",
      deletions: 4,
      path: "packages/github-testing-agent/src/workflow.ts",
      patch:
        "@@ -10,2 +10,14 @@\n+return evaluatePullRequestReviewHeuristics(context);\n",
      previousPath: null,
    },
  ],
  diffSnippets: [
    {
      path: "packages/github-testing-agent/src/workflow.ts",
      snippet:
        "@@ -10,2 +10,14 @@\n+return evaluatePullRequestReviewHeuristics(context);\n",
    },
  ],
  issueSelectionRationale: null,
  pullRequestBody: "Improves analysis logic but does not link an issue.",
  pullRequestTitle: "Refine testing-agent analysis heuristics",
});
