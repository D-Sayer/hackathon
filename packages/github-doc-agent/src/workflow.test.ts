import { describe, expect, test } from "bun:test";

import {
  DOCS_WRITE_TARGET,
  normalizeGitHubWebhookEvent,
  runGitHubDocAgentWorkflow,
} from "./index";

const payload = {
  action: "opened",
  installation: {
    id: 123,
  },
  pull_request: {
    base: {
      ref: "main",
    },
    draft: false,
    head: {
      ref: "feature/docs-agent",
    },
    html_url: "https://github.com/acme/repo/pull/42",
    number: 42,
    title: "Add docs agent",
  },
  repository: {
    default_branch: "main",
    full_name: "acme/repo",
    name: "repo",
    owner: {
      login: "acme",
    },
  },
};

describe("github doc agent workflow", () => {
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
    expect(result.event.pullRequest.number).toBe(42);
    expect(result.event.receivedAt).toBe("2026-03-18T00:00:00.000Z");
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
    });

    expect(result.accepted).toBe(true);
    expect(result.code).toBe("dry_run");
    expect(result.docsWriteTarget).toBe(DOCS_WRITE_TARGET);
    expect(result.sourcePrNumber).toBe(42);
  });
});
