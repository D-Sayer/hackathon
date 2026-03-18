import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  DOCS_WRITE_TARGET,
  evaluatePullRequestHeuristics,
  normalizeGitHubWebhookEvent,
  readGitHubWebhookHeaders,
  runGitHubDocAgentWorkflow,
  verifyGitHubWebhookSignature,
} from "./index";
import { pullRequestOpenedPayload } from "./__fixtures__/pull-request-opened";
import {
  apiChangeClassificationFixture,
  configChangeClassificationFixture,
  docsOnlyClassificationFixture,
  internalRefactorClassificationFixture,
  webFeatureClassificationFixture,
} from "./__fixtures__/pr-classification";

const payload = pullRequestOpenedPayload;
const payloadText = JSON.stringify(payload);
const webhookSecret = "super-secret";

function signWebhook(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("github doc agent workflow", () => {
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
    const result = normalizeGitHubWebhookEvent({
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
      "This PR adds the first docs agent intake slice.",
    );
    expect(result.event.pullRequest.number).toBe(42);
    expect(result.event.sender.login).toBe("octocat");
    expect(result.event.receivedAt).toBe("2026-03-18T00:00:00.000Z");
  });

  test("ignores unsupported pull request actions", () => {
    const result = normalizeGitHubWebhookEvent({
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
      message: 'pull_request action "closed" is not handled by the docs agent.',
    });
  });

  test("ignores unsupported GitHub events", () => {
    const result = normalizeGitHubWebhookEvent({
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

  test("ignores docs bot branches to prevent webhook loops", () => {
    const result = normalizeGitHubWebhookEvent({
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
            ...payload.pull_request.head,
            ref: "docs-bot/pr-42",
          },
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "ignored_docs_bot_branch",
      message: 'Ignored docs bot branch "docs-bot/pr-42" to prevent webhook loops.',
    });
  });

  test("returns a dry-run workflow result with the fumadocs write boundary", async () => {
    const normalized = normalizeGitHubWebhookEvent({
      headers: {
        deliveryId: "delivery-2",
        eventName: "pull_request",
        signature256: null,
      },
      payload,
      receivedAt: new Date("2026-03-18T00:00:00.000Z"),
    });

    if (!normalized.ok) {
      throw new Error("Expected webhook normalization to succeed.");
    }

    const result = await runGitHubDocAgentWorkflow({
      event: normalized.event,
      mode: "dry-run",
    });

    expect(result.accepted).toBe(false);
    expect(result.code).toBe("workflow_not_configured");
    expect(result.docsWriteTarget).toBe(DOCS_WRITE_TARGET);
    expect(result.sourcePrNumber).toBe(42);
  });

  test("skips the model for docs-only pull requests", () => {
    const result = evaluatePullRequestHeuristics(docsOnlyClassificationFixture);

    expect(result.shouldSkipModel).toBe(true);
    expect(result.decision).toEqual({
      needsDocs: false,
      proposedChanges: [],
      rationale:
        "The PR only changes documentation pages or markdown content, so it should not open a separate docs PR.",
      targetPages: [],
    });
  });

  test("skips the model for internal refactors with no docs impact", () => {
    const result = evaluatePullRequestHeuristics(
      internalRefactorClassificationFixture,
    );

    expect(result.shouldSkipModel).toBe(true);
    expect(result.decision).toEqual({
      needsDocs: false,
      proposedChanges: [],
      rationale:
        "The PR is explicitly described as an internal refactor with no behavior change, so it does not require documentation updates.",
      targetPages: [],
    });
  });

  test("classifies a web feature change as docs-needed when the model runs", async () => {
    const normalized = normalizeGitHubWebhookEvent({
      headers: {
        deliveryId: "delivery-feature",
        eventName: "pull_request",
        signature256: null,
      },
      payload,
      receivedAt: new Date("2026-03-18T00:00:00.000Z"),
    });

    if (!normalized.ok) {
      throw new Error("Expected webhook normalization to succeed.");
    }

    const result = await runGitHubDocAgentWorkflow(
      {
        event: normalized.event,
        mode: "dry-run",
      },
      {
        classifier: async () => ({
          needsDocs: true,
          proposedChanges: [
            "Document the new dashboard filter workflow for web users.",
          ],
          rationale: "The PR adds a user-facing dashboard filtering feature.",
          targetPages: ["dashboard"],
        }),
        loadPullRequestContext: async () => webFeatureClassificationFixture,
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.code).toBe("dry_run");
    expect(result.classification.needsDocs).toBe(true);
    expect(result.classification.source).toBe("model");
    expect(result.classification.targetPages).toEqual(["dashboard"]);
  });

  test("classifies an API change as docs-needed when the model runs", async () => {
    const normalized = normalizeGitHubWebhookEvent({
      headers: {
        deliveryId: "delivery-api",
        eventName: "pull_request",
        signature256: null,
      },
      payload,
    });

    if (!normalized.ok) {
      throw new Error("Expected webhook normalization to succeed.");
    }

    const result = await runGitHubDocAgentWorkflow(
      {
        event: normalized.event,
      },
      {
        classifier: async () => ({
          needsDocs: true,
          proposedChanges: ["Document the webhook replay API contract."],
          rationale: "The PR changes server behavior and API surface area.",
          targetPages: ["api/webhooks"],
        }),
        loadPullRequestContext: async () => apiChangeClassificationFixture,
      },
    );

    expect(result.classification.needsDocs).toBe(true);
    expect(result.classification.targetPages).toEqual(["api/webhooks"]);
    expect(result.classification.source).toBe("model");
  });

  test("classifies a config/setup change as docs-needed when the model runs", async () => {
    const normalized = normalizeGitHubWebhookEvent({
      headers: {
        deliveryId: "delivery-config",
        eventName: "pull_request",
        signature256: null,
      },
      payload,
    });

    if (!normalized.ok) {
      throw new Error("Expected webhook normalization to succeed.");
    }

    const result = await runGitHubDocAgentWorkflow(
      {
        event: normalized.event,
      },
      {
        classifier: async () => ({
          needsDocs: true,
          proposedChanges: [
            "Add setup guidance for the docs agent environment variables.",
          ],
          rationale: "The PR adds configuration that operators need to set up.",
          targetPages: ["setup/github-doc-agent"],
        }),
        loadPullRequestContext: async () => configChangeClassificationFixture,
      },
    );

    expect(result.classification.needsDocs).toBe(true);
    expect(result.classification.targetPages).toEqual([
      "setup/github-doc-agent",
    ]);
  });

  test("returns a no-docs classification without calling the model for docs-only changes", async () => {
    const normalized = normalizeGitHubWebhookEvent({
      headers: {
        deliveryId: "delivery-docs-only",
        eventName: "pull_request",
        signature256: null,
      },
      payload,
    });

    if (!normalized.ok) {
      throw new Error("Expected webhook normalization to succeed.");
    }

    let classifierCalled = false;

    const result = await runGitHubDocAgentWorkflow(
      {
        event: normalized.event,
      },
      {
        classifier: async () => {
          classifierCalled = true;

          return {
            needsDocs: true,
            proposedChanges: [],
            rationale: "Should not be used.",
            targetPages: [],
          };
        },
        loadPullRequestContext: async () => docsOnlyClassificationFixture,
      },
    );

    expect(classifierCalled).toBe(false);
    expect(result.classification.needsDocs).toBe(false);
    expect(result.classification.source).toBe("heuristic");
    expect(result.classification.wasModelSkipped).toBe(true);
  });
});
