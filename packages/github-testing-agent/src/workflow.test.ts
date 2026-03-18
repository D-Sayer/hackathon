import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  createGitHubTestingAgentWorkflowLogEntry,
  normalizeGitHubTestingWebhookEvent,
  readGitHubWebhookHeaders,
  runGitHubTestingAgentWorkflow,
  verifyGitHubWebhookSignature,
} from "./index";
import type { NormalizedTestingPullRequestWebhookEvent } from "./index";
import { pullRequestOpenedPayload } from "./__fixtures__/pull-request-opened";

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
      message: 'pull_request action "closed" is not handled by the testing agent.',
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
      message: 'Ignored bot branch "testing-bot/pr-42" to prevent webhook loops.',
    });
  });

  test("accepts dry-run workflow intake without needing issue context yet", async () => {
    const result = await runGitHubTestingAgentWorkflow(
      {
        event: createNormalizedEvent(),
        mode: "dry-run",
      },
      {
        isConfigured: true,
      },
    );

    expect(result).toEqual({
      accepted: true,
      code: "dry_run",
      message:
        "The testing agent accepted the pull request webhook in dry-run mode. Later slices will load PR and issue context.",
      sourcePrNumber: 42,
    });
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
      code: "workflow_not_configured",
      message:
        "The testing agent intake is wired, but the workflow is not enabled yet.",
      sourcePrNumber: 42,
    });
  });

  test("builds a safe structured workflow log entry", async () => {
    const event = createNormalizedEvent();
    const result = await runGitHubTestingAgentWorkflow({
      event,
      mode: "dry-run",
    });

    const logEntry = createGitHubTestingAgentWorkflowLogEntry({
      event,
      mode: "dry-run",
      result,
    });

    expect(logEntry).toEqual({
      accepted: true,
      action: "opened",
      code: "dry_run",
      deliveryId: "delivery-test",
      eventName: "pull_request",
      mode: "dry-run",
      sourcePrNumber: 42,
    });
  });
});
