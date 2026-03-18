import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import { pullRequestOpenedPayload } from "@hackathon/github-testing-agent/__fixtures__/pull-request-opened";

import { createApp } from "./app";

const webhookSecret = "super-secret";
const payload = pullRequestOpenedPayload;

function signWebhook(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function createTestEnv() {
  return {
    BETTER_AUTH_SECRET: "12345678901234567890123456789012",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:5173",
    DOCS_AGENT_MODEL: "gpt-4.1-mini-2025-04-14",
    GITHUB_APP_ID: undefined,
    GITHUB_APP_PRIVATE_KEY: undefined,
    GITHUB_DOC_AGENT_ENABLED: false,
    GITHUB_DOC_AGENT_MODE: "dry-run" as const,
    GITHUB_TESTING_AGENT_ENABLED: true,
    GITHUB_TESTING_AGENT_MODE: "dry-run" as const,
    GITHUB_WEBHOOK_SECRET: webhookSecret,
  };
}

describe("server github webhook intake", () => {
  test("rejects an invalid webhook signature with 401", async () => {
    const app = createApp(createTestEnv());
    const response = await app.request("/webhooks/github", {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "delivery-invalid-signature",
        "x-github-event": "pull_request",
        "x-hub-signature-256": signWebhook(
          JSON.stringify(payload),
          "wrong-secret",
        ),
      },
      method: "POST",
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "signature_mismatch",
      message: "GitHub webhook signature verification failed.",
    });
  });

  test("returns 202 for ignored but valid pull request actions", async () => {
    const ignoredPayload = {
      ...payload,
      action: "closed",
    };
    const body = JSON.stringify(ignoredPayload);
    const app = createApp(createTestEnv());
    const response = await app.request("/webhooks/github", {
      body,
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "delivery-ignored-action",
        "x-github-event": "pull_request",
        "x-hub-signature-256": signWebhook(body, webhookSecret),
      },
      method: "POST",
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      deliveryId: "delivery-ignored-action",
      docsAgent: {
        ok: false,
        code: "unsupported_action",
        message: 'pull_request action "closed" is not handled by the docs agent.',
      },
      eventName: "pull_request",
      testingAgent: {
        ok: false,
        code: "unsupported_action",
        message:
          'pull_request action "closed" is not handled by the testing agent.',
      },
    });
  });

  test("passes the normalized testing-agent contract into the workflow", async () => {
    const body = JSON.stringify(payload);
    let receivedEvent: unknown = null;

    const app = createApp(createTestEnv(), {
      runGitHubTestingAgentWorkflow: async ({ event, mode }) => {
        receivedEvent = event;

        return {
          accepted: true,
          code: mode === "live" ? "accepted" : "dry_run",
          message: "accepted for test",
          sourcePrNumber: event.pullRequest.number,
        };
      },
    });

    const response = await app.request("/webhooks/github", {
      body,
      headers: {
        "content-type": "application/json",
        "x-github-delivery": "delivery-normalized",
        "x-github-event": "pull_request",
        "x-hub-signature-256": signWebhook(body, webhookSecret),
      },
      method: "POST",
    });

    expect(response.status).toBe(202);
    expect(receivedEvent).toEqual({
      action: "opened",
      deliveryId: "delivery-normalized",
      eventName: "pull_request",
      installationId: 123456,
      pullRequest: {
        author: "octocat",
        baseRef: "main",
        body: "This PR adds the first testing agent intake slice.",
        draft: false,
        headRef: "feature/testing-agent-intake",
        htmlUrl: "https://github.com/acme/repo/pull/42",
        number: 42,
        title: "Add testing agent webhook intake",
      },
      receivedAt: expect.any(String),
      repository: {
        defaultBranch: "main",
        fullName: "acme/repo",
        name: "repo",
        owner: "acme",
      },
      sender: {
        login: "octocat",
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      deliveryId: "delivery-normalized",
      eventName: "pull_request",
      testingAgent: {
        accepted: true,
        code: "dry_run",
        message: "accepted for test",
        sourcePrNumber: 42,
      },
    });
  });
});
