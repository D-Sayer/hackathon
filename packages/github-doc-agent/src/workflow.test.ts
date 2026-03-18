import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  DOCS_WRITE_TARGET,
  generatePullRequestDocs,
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
const docsIndexPage = `---
title: Hello World
description: Your first document
---

Welcome to the docs!
`;

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
    expect(result.docGeneration).toBeNull();
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
        loadDocsPages: async () => [
          {
            content: docsIndexPage,
            path: "index.mdx",
          },
        ],
        loadPullRequestContext: async () => webFeatureClassificationFixture,
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.code).toBe("dry_run");
    expect(result.classification.needsDocs).toBe(true);
    expect(result.docGeneration?.operations).toHaveLength(1);
    expect(result.docGeneration?.operations[0]).toMatchObject({
      path: "apps/fumadocs/content/docs/dashboard.mdx",
      type: "create",
    });
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
        loadDocsPages: async () => [
          {
            content: docsIndexPage,
            path: "index.mdx",
          },
        ],
        loadPullRequestContext: async () => apiChangeClassificationFixture,
      },
    );

    expect(result.classification.needsDocs).toBe(true);
    if (!result.docGeneration?.operations[0]) {
      throw new Error("Expected a generated doc operation for the API change.");
    }

    expect(result.docGeneration.operations[0].path).toBe(
      "apps/fumadocs/content/docs/api/webhooks.mdx",
    );
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
        loadDocsPages: async () => [
          {
            content: docsIndexPage,
            path: "index.mdx",
          },
        ],
        loadPullRequestContext: async () => configChangeClassificationFixture,
      },
    );

    expect(result.classification.needsDocs).toBe(true);
    if (!result.docGeneration?.operations[0]) {
      throw new Error("Expected a generated doc operation for the config change.");
    }

    expect(result.docGeneration.operations[0].path).toBe(
      "apps/fumadocs/content/docs/setup/github-doc-agent.mdx",
    );
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
    expect(result.docGeneration).toBeNull();
    expect(result.classification.source).toBe("heuristic");
    expect(result.classification.wasModelSkipped).toBe(true);
  });

  test("updates an existing page when a target page already exists", async () => {
    const result = await generatePullRequestDocs(
      {
        classification: {
          needsDocs: true,
          proposedChanges: [
            "Document the dashboard quick filters for end users.",
          ],
          rationale: "The dashboard now exposes quick filters in the UI.",
          targetPages: ["index"],
        },
        context: webFeatureClassificationFixture,
        event: {
          action: "opened",
          deliveryId: "delivery-update-page",
          eventName: "pull_request",
          installationId: null,
          pullRequest: {
            author: "octocat",
            baseRef: "main",
            body: payload.pull_request.body,
            draft: false,
            headRef: "feature/dashboard-filters",
            htmlUrl: payload.pull_request.html_url,
            number: 42,
            title: "Add dashboard quick filters",
          },
          receivedAt: "2026-03-18T00:00:00.000Z",
          repository: {
            defaultBranch: "main",
            fullName: "acme/repo",
            name: "repo",
            owner: "acme",
          },
          sender: {
            login: "octocat",
          },
        },
      },
      {
        loadDocsPages: async () => [
          {
            content: docsIndexPage,
            path: "index.mdx",
          },
        ],
      },
    );

    expect(result.operations).toHaveLength(1);
    const updateOperation = result.operations[0];

    if (!updateOperation) {
      throw new Error("Expected an update operation.");
    }

    expect(updateOperation.type).toBe("update");
    expect(updateOperation.path).toBe(
      "apps/fumadocs/content/docs/index.mdx",
    );
    expect(updateOperation.content).toContain("title: Hello World");
    expect(updateOperation.content).toContain(
      "## PR #42 Documentation Update",
    );
    expect(result.patchSummary[0]).toContain(
      "Update apps/fumadocs/content/docs/index.mdx",
    );
  });

  test("creates a new page when no suitable target page exists", async () => {
    const result = await generatePullRequestDocs(
      {
        classification: {
          needsDocs: true,
          proposedChanges: [
            "Add setup guidance for GitHub docs agent environment variables.",
          ],
          rationale: "Operators need to configure new environment variables.",
          targetPages: ["setup/github-doc-agent"],
        },
        context: configChangeClassificationFixture,
        event: {
          action: "opened",
          deliveryId: "delivery-create-page",
          eventName: "pull_request",
          installationId: null,
          pullRequest: {
            author: "octocat",
            baseRef: "main",
            body: payload.pull_request.body,
            draft: false,
            headRef: "feature/docs-agent-config",
            htmlUrl: payload.pull_request.html_url,
            number: 42,
            title: "Add GitHub docs agent setup env vars",
          },
          receivedAt: "2026-03-18T00:00:00.000Z",
          repository: {
            defaultBranch: "main",
            fullName: "acme/repo",
            name: "repo",
            owner: "acme",
          },
          sender: {
            login: "octocat",
          },
        },
      },
      {
        loadDocsPages: async () => [
          {
            content: docsIndexPage,
            path: "index.mdx",
          },
        ],
      },
    );

    expect(result.operations).toHaveLength(1);
    const createOperation = result.operations[0];

    if (!createOperation) {
      throw new Error("Expected a create operation.");
    }

    expect(createOperation).toMatchObject({
      path: "apps/fumadocs/content/docs/setup/github-doc-agent.mdx",
      type: "create",
    });
    expect(createOperation.content).toContain('title: "Github Doc Agent"');
    expect(createOperation.content).toContain("## Overview");
  });

  test("rejects an out-of-scope path from the doc writer", async () => {
    await expect(
      generatePullRequestDocs(
        {
          classification: {
            needsDocs: true,
            proposedChanges: ["Document the dashboard filter workflow."],
            rationale: "The dashboard gained a user-facing filter workflow.",
            targetPages: ["dashboard"],
          },
          context: webFeatureClassificationFixture,
          event: {
            action: "opened",
            deliveryId: "delivery-reject-path",
            eventName: "pull_request",
            installationId: null,
            pullRequest: {
              author: "octocat",
              baseRef: "main",
              body: payload.pull_request.body,
              draft: false,
              headRef: "feature/dashboard-filters",
              htmlUrl: payload.pull_request.html_url,
              number: 42,
              title: "Add dashboard quick filters",
            },
            receivedAt: "2026-03-18T00:00:00.000Z",
            repository: {
              defaultBranch: "main",
              fullName: "acme/repo",
              name: "repo",
              owner: "acme",
            },
            sender: {
              login: "octocat",
            },
          },
        },
        {
          loadDocsPages: async () => [],
          writer: async () => [
            {
              content: "Unsafe path content",
              description: "Unsafe path content",
              path: "../outside.mdx",
              title: "Unsafe",
            },
          ],
        },
      ),
    ).rejects.toThrow("outside the allowed docs root");
  });

  test("rejects non-mdx file output from the doc writer", async () => {
    await expect(
      generatePullRequestDocs(
        {
          classification: {
            needsDocs: true,
            proposedChanges: [
              "Add setup guidance for GitHub docs agent environment variables.",
            ],
            rationale: "Operators need to configure new environment variables.",
            targetPages: ["setup/github-doc-agent"],
          },
          context: configChangeClassificationFixture,
          event: {
            action: "opened",
            deliveryId: "delivery-reject-type",
            eventName: "pull_request",
            installationId: null,
            pullRequest: {
              author: "octocat",
              baseRef: "main",
              body: payload.pull_request.body,
              draft: false,
              headRef: "feature/docs-agent-config",
              htmlUrl: payload.pull_request.html_url,
              number: 42,
              title: "Add GitHub docs agent setup env vars",
            },
            receivedAt: "2026-03-18T00:00:00.000Z",
            repository: {
              defaultBranch: "main",
              fullName: "acme/repo",
              name: "repo",
              owner: "acme",
            },
            sender: {
              login: "octocat",
            },
          },
        },
        {
          loadDocsPages: async () => [],
          writer: async () => [
            {
              content: "Wrong extension",
              description: "Wrong extension",
              path: "setup/github-doc-agent.txt",
              title: "Github Doc Agent",
            },
          ],
        },
      ),
    ).rejects.toThrow("must use an .mdx extension");
  });

  test("validates generated content is shaped for MDX docs usage", async () => {
    const result = await generatePullRequestDocs(
      {
        classification: {
          needsDocs: true,
          proposedChanges: [
            "Add setup guidance for GitHub docs agent environment variables.",
          ],
          rationale: "Operators need to configure new environment variables.",
          targetPages: ["setup/github-doc-agent"],
        },
        context: configChangeClassificationFixture,
        event: {
          action: "opened",
          deliveryId: "delivery-mdx-shape",
          eventName: "pull_request",
          installationId: null,
          pullRequest: {
            author: "octocat",
            baseRef: "main",
            body: payload.pull_request.body,
            draft: false,
            headRef: "feature/docs-agent-config",
            htmlUrl: payload.pull_request.html_url,
            number: 42,
            title: "Add GitHub docs agent setup env vars",
          },
          receivedAt: "2026-03-18T00:00:00.000Z",
          repository: {
            defaultBranch: "main",
            fullName: "acme/repo",
            name: "repo",
            owner: "acme",
          },
          sender: {
            login: "octocat",
          },
        },
      },
      {
        loadDocsPages: async () => [],
      },
    );

    const generatedOperation = result.operations[0];

    if (!generatedOperation) {
      throw new Error("Expected generated MDX content.");
    }

    expect(generatedOperation.content).toMatch(/^---\n[\s\S]*\n---\n\n## Overview/m);
    expect(generatedOperation.content).toContain(
      "## Source Pull Request",
    );
  });
});
