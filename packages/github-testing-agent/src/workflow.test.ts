import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { pullRequestOpenedPayload } from "./__fixtures__/pull-request-opened";
import {
  configChangeReviewContextFixture,
  docsOnlyReviewContextFixture,
  featureReviewContextFixture,
  internalRefactorReviewContextFixture,
  noAttachedIssueReviewContextFixture,
  partialBugfixReviewContextFixture,
} from "./__fixtures__/review-analysis";
import type { NormalizedTestingPullRequestWebhookEvent } from "./index";
import {
  createAiPullRequestReviewAnalyzer,
  createIssueFeedbackCommentMarker,
  createGitHubTestingAgentWorkflowLogEntry,
  evaluatePullRequestReviewHeuristics,
  renderIssueFeedbackComment,
  normalizeGitHubTestingWebhookEvent,
  readGitHubWebhookHeaders,
  resolveAttachedIssueReference,
  runGitHubTestingAgentWorkflow,
  verifyGitHubWebhookSignature,
} from "./index";

const payload = pullRequestOpenedPayload;
const payloadText = JSON.stringify(payload);
const webhookSecret = "super-secret";

function signWebhook(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function createNormalizedEvent(): NormalizedTestingPullRequestWebhookEvent {
  const normalized = normalizeGitHubTestingWebhookEvent({
    headers: {
      deliveryId: "delivery-test",
      eventName: "pull_request",
      signature256: null,
    },
    payload,
    receivedAt: new Date("2026-03-18T00:00:00.000Z"),
  });

  if (!normalized.ok) {
    throw new Error("Expected webhook normalization to succeed.");
  }

  return normalized.event;
}

describe("github testing agent intake", () => {
  test("verifies a valid webhook signature", () => {
    const result = verifyGitHubWebhookSignature({
      payloadText,
      secret: webhookSecret,
      signature256: signWebhook(payloadText, webhookSecret),
    });

    expect(result).toBeNull();
  });

  test("rejects an invalid webhook signature", () => {
    const result = verifyGitHubWebhookSignature({
      payloadText,
      secret: webhookSecret,
      signature256: signWebhook(payloadText, "wrong-secret"),
    });

    expect(result).toEqual({
      ok: false,
      code: "signature_mismatch",
      message: "GitHub webhook signature verification failed.",
    });
  });

  test("reads the required GitHub webhook headers", () => {
    const headers = new Headers({
      "x-github-delivery": "delivery-headers",
      "x-github-event": "pull_request",
      "x-hub-signature-256": "sha256=test",
    });

    expect(readGitHubWebhookHeaders(headers)).toEqual({
      deliveryId: "delivery-headers",
      eventName: "pull_request",
      signature256: "sha256=test",
    });
  });

  test("normalizes a supported pull request webhook", () => {
    const result = normalizeGitHubTestingWebhookEvent({
      headers: {
        deliveryId: "delivery-1",
        eventName: "pull_request",
        signature256: "sha256=test",
      },
      payload,
      receivedAt: new Date("2026-03-18T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.event.repository.fullName).toBe("acme/repo");
    expect(result.event.pullRequest.author).toBe("octocat");
    expect(result.event.pullRequest.body).toBe(
      "This PR adds the first testing agent intake slice.",
    );
    expect(result.event.pullRequest.number).toBe(42);
    expect(result.event.sender.login).toBe("octocat");
    expect(result.event.receivedAt).toBe("2026-03-18T00:00:00.000Z");
  });

  test("ignores unsupported pull request actions", () => {
    const result = normalizeGitHubTestingWebhookEvent({
      headers: {
        deliveryId: "delivery-unsupported-action",
        eventName: "pull_request",
        signature256: "sha256=test",
      },
      payload: {
        ...payload,
        action: "closed",
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "unsupported_action",
      message:
        'pull_request action "closed" is not handled by the testing agent.',
    });
  });

  test("ignores unsupported GitHub events", () => {
    const result = normalizeGitHubTestingWebhookEvent({
      headers: {
        deliveryId: "delivery-unsupported-event",
        eventName: "push",
        signature256: "sha256=test",
      },
      payload,
    });

    expect(result).toEqual({
      ok: false,
      code: "unsupported_event",
      message: "Only pull_request webhooks are supported.",
    });
  });

  test("ignores bot-authored pull requests", () => {
    const result = normalizeGitHubTestingWebhookEvent({
      headers: {
        deliveryId: "delivery-bot-author",
        eventName: "pull_request",
        signature256: "sha256=test",
      },
      payload: {
        ...payload,
        pull_request: {
          ...payload.pull_request,
          user: {
            login: "github-testing-agent[bot]",
          },
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "ignored_bot_author",
      message:
        'Ignored bot-authored pull request from "github-testing-agent[bot]".',
    });
  });

  test("ignores testing bot branches to prevent webhook loops", () => {
    const result = normalizeGitHubTestingWebhookEvent({
      headers: {
        deliveryId: "delivery-bot-branch",
        eventName: "pull_request",
        signature256: "sha256=test",
      },
      payload: {
        ...payload,
        pull_request: {
          ...payload.pull_request,
          head: {
            ref: "testing-bot/pr-42",
          },
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "ignored_bot_branch",
      message:
        'Ignored bot branch "testing-bot/pr-42" to prevent webhook loops.',
    });
  });

  test("accepts dry-run workflow intake after loading review context", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "dry-run",
      },
      {
        isConfigured: true,
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.code).toBe("dry_run");
    expect(result.analysis.source).toBe("fallback");
    expect(result.analysis.shouldComment).toBe(true);
    expect(result.context).toEqual({
      attachedIssueNumber: 123,
      changedFileCount: 3,
      diffSnippetCount: 2,
      existingFeedbackCommentId: null,
      issueReferenceSource: "body",
    });
    expect(result.writeback.status).toBe("dry_run");
    expect(result.writeback.renderedBody).not.toBeNull();
    expect(result.writeback.renderedBody!).toContain("## Summary");
    expect(result.writeback.renderedBody!).toContain(
      createIssueFeedbackCommentMarker({
        sourcePrNumber: 42,
      }),
    );
    expect(result.message).toBe(
      "Review analysis completed in dry-run mode for the testing agent. Actionable issue follow-up was identified. Decision source: fallback. Attached issue #123 was loaded from the body. Rendered the issue feedback comment in dry-run mode without writing to GitHub.",
    );
  });

  test("surfaces when the workflow is not enabled", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
      },
      {
        isConfigured: false,
      },
    );

    expect(result).toEqual({
      accepted: false,
      analysis: {
        blastRadius: [],
        changedFilesConsidered: [],
        confidence: "low",
        implementationGaps: [],
        oversights: [],
        rationale:
          "The workflow is not configured, so pull request review analysis did not run.",
        shouldComment: false,
        source: "fallback",
        summary:
          "Review analysis did not run because the testing agent is not enabled.",
        testingNotes: [],
        wasModelSkipped: true,
      },
      code: "workflow_not_configured",
      context: null,
      message:
        "The testing agent intake is wired, but the workflow is not enabled yet.",
      sourcePrNumber: 42,
      writeback: {
        commentId: null,
        errorMessage: null,
        renderedBody: null,
        status: "skipped",
      },
    });
  });

  test("surfaces when the review context loader is not configured", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
      },
      {
        isConfigured: true,
      },
    );

    expect(result).toEqual({
      accepted: false,
      analysis: {
        blastRadius: [],
        changedFilesConsidered: [],
        confidence: "low",
        implementationGaps: [],
        oversights: [],
        rationale:
          "The workflow cannot analyze this pull request because no PR and issue review context loader is configured.",
        shouldComment: false,
        source: "fallback",
        summary:
          "Review analysis did not run because PR and issue context loading is not configured.",
        testingNotes: [],
        wasModelSkipped: true,
      },
      code: "workflow_not_configured",
      context: null,
      message:
        "The testing agent workflow needs a PR and issue context loader before review can run.",
      sourcePrNumber: 42,
      writeback: {
        commentId: null,
        errorMessage: null,
        renderedBody: null,
        status: "skipped",
      },
    });
  });

  test("exits safely when no attached issue reference is present", async () => {
    let analyzerCalled = false;

    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
      },
      {
        analyzer: async () => {
          analyzerCalled = true;

          return {
            blastRadius: [],
            confidence: "high",
            implementationGaps: [],
            oversights: [],
            rationale: "Should not run.",
            shouldComment: true,
            summary: "Should not run.",
            testingNotes: [],
          };
        },
        isConfigured: true,
        loadPullRequestReviewContext: async () =>
          noAttachedIssueReviewContextFixture,
      },
    );

    expect(analyzerCalled).toBe(false);
    expect(result.analysis).toMatchObject({
      confidence: "high",
      rationale:
        "V1 only comments on attached issues, and no attached issue could be loaded for this pull request.",
      shouldComment: false,
      source: "heuristic",
      summary:
        "No issue feedback comment will be generated because the PR does not resolve a loadable attached issue.",
      wasModelSkipped: true,
    });
    expect(result.context).toEqual({
      attachedIssueNumber: null,
      changedFileCount: 1,
      diffSnippetCount: 1,
      existingFeedbackCommentId: null,
      issueReferenceSource: null,
    });
    expect(result.writeback).toEqual({
      commentId: null,
      errorMessage: null,
      renderedBody: null,
      status: "not_needed",
    });
  });

  test("builds a safe structured workflow log entry", async () => {
    const event = createNormalizedEvent();
    const result = await runGitHubTestingAgentWorkflow(
      {
        event,
        mode: "dry-run",
      },
      {
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    const logEntry = createGitHubTestingAgentWorkflowLogEntry({
      event,
      mode: "dry-run",
      result,
    });

    expect(logEntry).toEqual({
      accepted: true,
      action: "opened",
      analysisShouldComment: true,
      analysisSource: "fallback",
      attachedIssueNumber: 123,
      code: "dry_run",
      confidence: "low",
      deliveryId: "delivery-test",
      eventName: "pull_request",
      mode: "dry-run",
      sourcePrNumber: 42,
      wasModelSkipped: true,
      writebackErrorMessage: null,
      writebackStatus: "dry_run",
    });
  });

  test("includes writeback error details in the structured workflow log entry", async () => {
    const event = createNormalizedEvent();
    const result = await runGitHubTestingAgentWorkflow(
      {
        event,
        mode: "live",
      },
      {
        isConfigured: true,
        issueCommentClient: {
          createIssueComment: async () => {
            throw new Error("GitHub API POST /repos/acme/repo/issues/123/comments failed (403): Resource not accessible by integration");
          },
          listIssueComments: async () => [],
          updateIssueComment: async () => {
            throw new Error("Should not update");
          },
        },
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    const logEntry = createGitHubTestingAgentWorkflowLogEntry({
      event,
      mode: "live",
      result,
    });

    expect(logEntry).toMatchObject({
      sourcePrNumber: 42,
      writebackErrorMessage:
        "GitHub API POST /repos/acme/repo/issues/123/comments failed (403): Resource not accessible by integration",
      writebackStatus: "failed",
    });
  });

  test("parses issue references from title and body in priority order", () => {
    const resolved = resolveAttachedIssueReference({
      body: "Related work in #456 and resolves #789.",
      repository: {
        name: "repo",
        owner: "acme",
      },
      title: "Fixes #123 testing agent context",
    });

    expect(resolved.reference).toEqual({
      keyword: "fixes",
      matchedText: "Fixes #123",
      number: 123,
      owner: "acme",
      repo: "repo",
      source: "title",
    });
    expect(resolved.references.map((reference) => reference.number)).toEqual([
      123, 456, 789,
    ]);
  });

  test("skips the model for internal refactors with no linked behavior change", () => {
    const result = evaluatePullRequestReviewHeuristics(
      internalRefactorReviewContextFixture,
    );

    expect(result.shouldSkipModel).toBe(true);
    expect(result.decision).toEqual({
      blastRadius: [],
      confidence: "high",
      implementationGaps: [],
      oversights: [],
      rationale:
        "The PR is explicitly framed as an internal refactor with no external behavior change, so review feedback would likely be non-actionable.",
      shouldComment: false,
      summary:
        "No issue feedback comment is needed because the PR is an internal refactor.",
      testingNotes: [],
    });
  });

  test("skips the model for docs-only pull requests", () => {
    const result = evaluatePullRequestReviewHeuristics(
      docsOnlyReviewContextFixture,
    );

    expect(result.shouldSkipModel).toBe(true);
    expect(result.decision).toEqual({
      blastRadius: [],
      confidence: "high",
      implementationGaps: [],
      oversights: [],
      rationale:
        "The PR only changes documentation or markdown content, so there is no implementation review feedback to post back to the issue.",
      shouldComment: false,
      summary:
        "No issue feedback comment is needed because the PR is docs-only.",
      testingNotes: [],
    });
  });

  test("runs the analyzer for a feature PR with an attached issue", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
      },
      {
        analyzer: async () => ({
          blastRadius: [
            "Server webhook intake and shared testing-agent workflow behavior are both affected.",
          ],
          confidence: "high",
          implementationGaps: [
            "The workflow analysis is added, but stable issue comment rendering is still not implemented.",
          ],
          oversights: [
            "There is no explicit regression coverage for rerunning against an existing feedback comment.",
          ],
          rationale:
            "The PR introduces analysis behavior for a linked issue, but the end-to-end workflow still stops short of writeback.",
          shouldComment: true,
          summary:
            "The PR adds structured review analysis, but the linked issue is not fully addressed until comment rendering and writeback land.",
          testingNotes: [
            "Add coverage for comment-update reruns and failure paths before marking the issue done.",
          ],
        }),
        isConfigured: true,
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    expect(result.analysis).toMatchObject({
      confidence: "high",
      implementationGaps: [
        "The workflow analysis is added, but stable issue comment rendering is still not implemented.",
      ],
      shouldComment: true,
      source: "model",
      wasModelSkipped: false,
    });
    expect(result.message).toContain("Decision source: model.");
  });

  test("runs the analyzer for a partial bug fix and returns testing notes", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
      },
      {
        analyzer: async () => ({
          blastRadius: [
            "Webhook intake error handling changed for all GitHub deliveries.",
          ],
          confidence: "medium",
          implementationGaps: [
            "The invalid JSON path is covered, but duplicate-comment retry handling from the linked issue is still unaddressed.",
          ],
          oversights: [],
          rationale:
            "The PR addresses one failure path from the issue but not the idempotency concern called out in the issue body.",
          shouldComment: true,
          summary:
            "The bug fix is only partial because retry idempotency for duplicate comments is still missing.",
          testingNotes: [
            "Add a regression test for retried deliveries to prove duplicate comments are not created.",
          ],
        }),
        isConfigured: true,
        loadPullRequestReviewContext: async () =>
          partialBugfixReviewContextFixture,
      },
    );

    expect(result.analysis.summary).toContain("only partial");
    expect(result.analysis.testingNotes).toEqual([
      "Add a regression test for retried deliveries to prove duplicate comments are not created.",
    ]);
  });

  test("runs the analyzer for config changes and calls out blast radius", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
      },
      {
        analyzer: async () => ({
          blastRadius: [
            "Environment validation and deployment configuration both need verification before rollout.",
          ],
          confidence: "medium",
          implementationGaps: [],
          oversights: [
            "The PR should confirm how missing env vars behave in production.",
          ],
          rationale:
            "The change is mostly operational, so the most useful follow-up is rollout validation and blast-radius awareness.",
          shouldComment: true,
          summary:
            "The config wiring looks directionally right, but the issue should track rollout validation and missing-env behavior.",
          testingNotes: [
            "Exercise boot-time validation in both dry-run and live testing-agent modes.",
          ],
        }),
        isConfigured: true,
        loadPullRequestReviewContext: async () =>
          configChangeReviewContextFixture,
      },
    );

    expect(result.analysis.blastRadius).toEqual([
      "Environment validation and deployment configuration both need verification before rollout.",
    ]);
    expect(result.analysis.shouldComment).toBe(true);
  });

  test("uses the AI SDK review analyzer helper with structured output", async () => {
    const analyzer = createAiPullRequestReviewAnalyzer({
      model: {
        doGenerate: async () => ({
          finishReason: "stop",
          rawCall: { rawPrompt: null, rawSettings: {} },
          response: {
            headers: {},
            id: "response-1",
            messages: [],
            modelId: "test-model",
            timestamp: new Date("2026-03-18T00:00:00.000Z"),
          },
          text: JSON.stringify({
            blastRadius: ["Shared server routes may be affected."],
            confidence: "medium",
            implementationGaps: [
              "Stable issue comment writeback is still missing.",
            ],
            oversights: ["No rerun test was added for existing issue comments."],
            rationale: "The linked issue remains only partially complete.",
            shouldComment: true,
            summary: "The PR adds analysis but still leaves follow-up work.",
            testingNotes: ["Add a regression test for rerun idempotency."],
          }),
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
        doStream: async () => {
          throw new Error("Streaming is not expected in this test.");
        },
        modelId: "test-model",
        provider: "test-provider",
        specificationVersion: "v2",
      } as never,
    });

    const result = await analyzer({
      context: featureReviewContextFixture,
      diffSnippets: featureReviewContextFixture.diffSnippets,
      filteredChangedFiles: featureReviewContextFixture.changedFiles.map(
        (file) => file.path,
      ),
    });

    expect(result).toEqual({
      blastRadius: ["Shared server routes may be affected."],
      confidence: "medium",
      implementationGaps: ["Stable issue comment writeback is still missing."],
      oversights: ["No rerun test was added for existing issue comments."],
      rationale: "The linked issue remains only partially complete.",
      shouldComment: true,
      summary: "The PR adds analysis but still leaves follow-up work.",
      testingNotes: ["Add a regression test for rerun idempotency."],
    });
  });

  test("renders a stable issue comment body", () => {
    const rendered = renderIssueFeedbackComment({
      agentIdentity: "github-testing-agent",
      analysis: {
        blastRadius: ["Shared workflow and server entrypoints are affected."],
        confidence: "medium",
        implementationGaps: ["Comment writeback still needs live coverage."],
        oversights: ["No regression test covers reruns yet."],
        rationale: "The issue remains partially complete.",
        shouldComment: true,
        summary: "The workflow is closer, but the linked issue is not done yet.",
        testingNotes: ["Add a rerun test for existing bot comments."],
      },
      attachedIssue: featureReviewContextFixture.attachedIssue!,
      sourcePullRequest: createNormalizedEvent().pullRequest,
    });

    expect(rendered.marker).toBe(
      "<!-- github-testing-agent:agent=github-testing-agent;source-pr-number=42 -->",
    );
    expect(rendered.body).toContain("## Summary");
    expect(rendered.body).toContain("## Implementation Gaps");
    expect(rendered.body).toContain("## Source Pull Request");
    expect(rendered.body).toContain(
      "[#42 Add the first testing agent intake slice.](https://github.com/acme/repo/pull/42)",
    );
  });

  test("creates a bot comment when no matching issue comment exists", async () => {
    const listCalls: number[] = [];
    const createCalls: string[] = [];
    const updateCalls: number[] = [];

    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "live",
      },
      {
        isConfigured: true,
        issueCommentClient: {
          createIssueComment: async ({ body }) => {
            createCalls.push(body);

            return {
              authorLogin: "hackathon-testing-agent[bot]",
              body,
              commentId: 7001,
              htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-7001",
            };
          },
          listIssueComments: async ({ issueNumber }) => {
            listCalls.push(issueNumber);

            return [];
          },
          updateIssueComment: async ({ commentId }) => {
            updateCalls.push(commentId);
            throw new Error("Should not update");
          },
        },
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    expect(listCalls).toEqual([123]);
    expect(createCalls).toHaveLength(1);
    const createdBody = createCalls[0];

    if (!createdBody) {
      throw new Error("Expected a created comment body.");
    }

    expect(createdBody).toContain("## Summary");
    expect(updateCalls).toEqual([]);
    expect(result.writeback).toEqual({
      commentId: 7001,
      errorMessage: null,
      renderedBody: createdBody,
      status: "created",
    });
    expect(result.message).toContain("Created issue feedback comment 7001.");
  });

  test("updates an existing bot comment on rerun", async () => {
    const updatedBodies: string[] = [];

    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "live",
      },
      {
        isConfigured: true,
        issueCommentClient: {
          createIssueComment: async () => {
            throw new Error("Should not create");
          },
          listIssueComments: async () => [
            {
              authorLogin: "hackathon-testing-agent[bot]",
              body:
                "<!-- github-testing-agent:source-pr-number=42 -->\nOld body",
              commentId: 7002,
              htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-7002",
            },
          ],
          updateIssueComment: async ({ body, commentId }) => {
            updatedBodies.push(body);

            return {
              authorLogin: "hackathon-testing-agent[bot]",
              body,
              commentId,
              htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-7002",
            };
          },
        },
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    expect(updatedBodies).toHaveLength(1);
    expect(result.writeback.status).toBe("updated");
    expect(result.writeback.commentId).toBe(7002);
    expect(result.message).toContain("Updated issue feedback comment 7002.");
  });

  test("skips writeback when shouldComment is false", async () => {
    let listCalled = false;

    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "live",
      },
      {
        isConfigured: true,
        issueCommentClient: {
          createIssueComment: async () => {
            throw new Error("Should not create");
          },
          listIssueComments: async () => {
            listCalled = true;
            return [];
          },
          updateIssueComment: async () => {
            throw new Error("Should not update");
          },
        },
        loadPullRequestReviewContext: async () => docsOnlyReviewContextFixture,
      },
    );

    expect(listCalled).toBe(false);
    expect(result.writeback).toEqual({
      commentId: null,
      errorMessage: null,
      renderedBody: null,
      status: "not_needed",
    });
  });

  test("skips updating when the rendered body is unchanged", async () => {
    const rendered = renderIssueFeedbackComment({
      agentIdentity: "github-testing-agent",
      analysis: {
        blastRadius: [
          "Changed surface: packages/github-testing-agent/src/workflow.ts",
          "Changed surface: apps/server/src/app.ts",
          "Changed surface: packages/github-testing-agent/src/workflow.test.ts",
        ],
        confidence: "low",
        implementationGaps: [
          "Review the linked issue against the touched code paths to confirm the shipped scope fully matches the requested outcome.",
        ],
        oversights: [],
        rationale:
          "Positive implementation signals were found, but no AI review analyzer is configured. Falling back to a conservative should-comment decision.",
        shouldComment: true,
        summary:
          "Potential implementation or testing follow-up is likely, but no AI review analyzer is configured to summarize the findings precisely.",
        testingNotes: [
          "Validate the touched server, web, and shared package changes with focused tests or manual verification before closing the linked issue.",
        ],
      },
      attachedIssue: featureReviewContextFixture.attachedIssue!,
      sourcePullRequest: createNormalizedEvent().pullRequest,
    });
    let updateCalled = false;

    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "live",
      },
      {
        isConfigured: true,
        issueCommentClient: {
          createIssueComment: async () => {
            throw new Error("Should not create");
          },
          listIssueComments: async () => [
            {
              authorLogin: "hackathon-testing-agent[bot]",
              body: rendered.body,
              commentId: 7003,
              htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-7003",
            },
          ],
          updateIssueComment: async () => {
            updateCalled = true;
            throw new Error("Should not update");
          },
        },
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    expect(updateCalled).toBe(false);
    expect(result.writeback).toEqual({
      commentId: 7003,
      errorMessage: null,
      renderedBody: rendered.body,
      status: "unchanged",
    });
  });

  test("handles partial GitHub API failures cleanly", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "live",
      },
      {
        isConfigured: true,
        issueCommentClient: {
          createIssueComment: async () => {
            throw new Error("GitHub create failed (502)");
          },
          listIssueComments: async () => [],
          updateIssueComment: async () => {
            throw new Error("Should not update");
          },
        },
        loadPullRequestReviewContext: async () => featureReviewContextFixture,
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.writeback.status).toBe("failed");
    expect(result.writeback.errorMessage).toBe("GitHub create failed (502)");
    expect(result.message).toContain(
      "Issue comment writeback failed: GitHub create failed (502)",
    );
  });
});
