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
  createGitHubTestingAgentWorkflowLogEntry,
  evaluatePullRequestReviewHeuristics,
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
    expect(result.message).toBe(
      "Review analysis completed in dry-run mode for the testing agent. Actionable issue follow-up was identified. Decision source: fallback. Attached issue #123 was loaded from the body.",
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
});
