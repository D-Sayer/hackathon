import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  createGitHubAppIssueCommentWritebackClient,
  createGitHubAppPullRequestReviewContextLoader,
} from "./index";
import type { NormalizedTestingPullRequestWebhookEvent } from "./index";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const event: NormalizedTestingPullRequestWebhookEvent = {
  action: "opened",
  deliveryId: "delivery-1",
  eventName: "pull_request",
  installationId: 99,
  pullRequest: {
    author: "octocat",
    baseRef: "main",
    body: "Implements context loading.\n\nFixes #123\nRelates to #456",
    draft: false,
    headRef: "feature/testing-agent-context",
    htmlUrl: "https://github.com/acme/repo/pull/42",
    number: 42,
    title: "Add testing-agent context loading",
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
};

function createJsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: init?.status ?? 200,
  });
}

function createMockFetch(
  steps: Array<{
    assert: (request: { init?: RequestInit; url: string }) => void;
    response: Response;
  }>,
): typeof fetch {
  return (async (input, init) => {
    const nextStep = steps.shift();

    if (!nextStep) {
      throw new Error(`Unexpected fetch call: ${String(input)}`);
    }

    nextStep.assert({
      init,
      url: String(input),
    });

    return nextStep.response;
  }) as typeof fetch;
}

describe("github testing agent review context loader", () => {
  test("loads changed files attached issue and existing feedback comment", async () => {
    const loader = createGitHubAppPullRequestReviewContextLoader({
      appId: "123",
      fetch: createMockFetch([
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/pulls/42/files");
            expect(url).toContain("page=1");
          },
          response: createJsonResponse([
            {
              additions: 12,
              deletions: 3,
              filename: "apps/server/src/app.ts",
              patch: "@@ -1 +1 @@\n-old\n+new",
              status: "modified",
            },
            {
              additions: 4,
              deletions: 0,
              filename: "packages/github-testing-agent/src/workflow.ts",
              patch: "@@ -10 +10 @@\n-old\n+new",
              previous_filename: "packages/github-testing-agent/src/old-workflow.ts",
              status: "renamed",
            },
          ]),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/123");
          },
          response: createJsonResponse({
            body: "The issue body",
            html_url: "https://github.com/acme/repo/issues/123",
            number: 123,
            state: "open",
            title: "Issue title",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/123/comments");
            expect(url).toContain("page=1");
          },
          response: createJsonResponse([
            {
              body: "First human comment",
              html_url: "https://github.com/acme/repo/issues/123#issuecomment-1",
              id: 1,
              user: {
                login: "octocat",
                type: "User",
              },
            },
            {
              body:
                "<!-- github-testing-agent:source-pr-number=42 -->\nLinked to https://github.com/acme/repo/pull/42",
              html_url: "https://github.com/acme/repo/issues/123#issuecomment-2",
              id: 2,
              user: {
                login: "hackathon-testing-agent[bot]",
                type: "Bot",
              },
            },
          ]),
        },
      ]),
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const context = await loader(event);

    expect(context.attachedIssueReference).toEqual({
      keyword: "fixes",
      matchedText: "Fixes #123",
      number: 123,
      owner: "acme",
      repo: "repo",
      source: "body",
    });
    expect(context.issueSelectionRationale).toBe(
      "Selected issue #123 from the body as the first resolvable reference. All parsed references: #123, #456.",
    );
    expect(context.attachedIssue).toEqual({
      body: "The issue body",
      htmlUrl: "https://github.com/acme/repo/issues/123",
      number: 123,
      state: "open",
      title: "Issue title",
    });
    expect(context.changedFiles).toEqual([
      {
        additions: 12,
        changeType: "modified",
        deletions: 3,
        path: "apps/server/src/app.ts",
        patch: "@@ -1 +1 @@\n-old\n+new",
        previousPath: null,
      },
      {
        additions: 4,
        changeType: "renamed",
        deletions: 0,
        path: "packages/github-testing-agent/src/workflow.ts",
        patch: "@@ -10 +10 @@\n-old\n+new",
        previousPath: "packages/github-testing-agent/src/old-workflow.ts",
      },
    ]);
    expect(context.diffSnippets).toEqual([
      {
        path: "apps/server/src/app.ts",
        snippet: "@@ -1 +1 @@\n-old\n+new",
      },
      {
        path: "packages/github-testing-agent/src/workflow.ts",
        snippet: "@@ -10 +10 @@\n-old\n+new",
      },
    ]);
    expect(context.existingFeedbackComment).toEqual({
      authorLogin: "hackathon-testing-agent[bot]",
      body:
        "<!-- github-testing-agent:source-pr-number=42 -->\nLinked to https://github.com/acme/repo/pull/42",
      commentId: 2,
      htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-2",
    });
  });

  test("returns null attached issue when the referenced issue is missing", async () => {
    const loader = createGitHubAppPullRequestReviewContextLoader({
      appId: "123",
      fetch: createMockFetch([
        {
          assert: ({ url }) => {
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/pulls/42/files");
          },
          response: createJsonResponse([]),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/123");
          },
          response: createJsonResponse(
            {
              message: "Not Found",
            },
            {
              status: 404,
            },
          ),
        },
      ]),
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const context = await loader({
      ...event,
      pullRequest: {
        ...event.pullRequest,
        body: "Fixes #123",
      },
    });

    expect(context.attachedIssueReference?.number).toBe(123);
    expect(context.attachedIssue).toBeNull();
    expect(context.existingFeedbackComment).toBeNull();
  });

  test("selects the first resolvable issue when earlier references are missing", async () => {
    const loader = createGitHubAppPullRequestReviewContextLoader({
      appId: "123",
      fetch: createMockFetch([
        {
          assert: ({ url }) => {
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/pulls/42/files");
          },
          response: createJsonResponse([]),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/123");
          },
          response: createJsonResponse(
            {
              message: "Not Found",
            },
            {
              status: 404,
            },
          ),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/456");
          },
          response: createJsonResponse({
            body: "Second issue body",
            html_url: "https://github.com/acme/repo/issues/456",
            number: 456,
            state: "open",
            title: "Fallback issue title",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/456/comments");
          },
          response: createJsonResponse([]),
        },
      ]),
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const context = await loader({
      ...event,
      pullRequest: {
        ...event.pullRequest,
        body: "Fixes #123 and plain follow-up #456",
      },
    });

    expect(context.attachedIssueReference?.number).toBe(456);
    expect(context.attachedIssue?.number).toBe(456);
    expect(context.issueSelectionRationale).toBe(
      "Selected issue #456 from the body as the first resolvable reference. All parsed references: #123, #456.",
    );
  });

  test("returns null issue reference when the PR does not mention an issue", async () => {
    const loader = createGitHubAppPullRequestReviewContextLoader({
      appId: "123",
      fetch: createMockFetch([
        {
          assert: ({ url }) => {
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/pulls/42/files");
          },
          response: createJsonResponse([]),
        },
      ]),
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const context = await loader({
      ...event,
      pullRequest: {
        ...event.pullRequest,
        body: "No linked issue in this PR.",
        title: "Add testing agent context loading",
      },
    });

    expect(context.attachedIssueReference).toBeNull();
    expect(context.attachedIssue).toBeNull();
    expect(context.issueSelectionRationale).toBeNull();
    expect(context.existingFeedbackComment).toBeNull();
  });

  test("lists bot issue comments for writeback", async () => {
    const client = createGitHubAppIssueCommentWritebackClient({
      appId: "123",
      fetch: createMockFetch([
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/repos/acme/repo/issues/123/comments");
            expect(url).toContain("page=1");
          },
          response: createJsonResponse([
            {
              body: "Human comment",
              html_url: "https://github.com/acme/repo/issues/123#issuecomment-1",
              id: 1,
              user: {
                login: "octocat",
                type: "User",
              },
            },
            {
              body:
                "<!-- github-testing-agent:agent=github-testing-agent;source-pr-number=42 -->\nBody",
              html_url: "https://github.com/acme/repo/issues/123#issuecomment-2",
              id: 2,
              user: {
                login: "hackathon-testing-agent[bot]",
                type: "Bot",
              },
            },
          ]),
        },
      ]),
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const comments = await client.listIssueComments({
      event,
      issueNumber: 123,
    });

    expect(comments).toEqual([
      {
        authorLogin: "hackathon-testing-agent[bot]",
        body:
          "<!-- github-testing-agent:agent=github-testing-agent;source-pr-number=42 -->\nBody",
        commentId: 2,
        htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-2",
      },
    ]);
  });

  test("creates and updates issue comments for writeback", async () => {
    const client = createGitHubAppIssueCommentWritebackClient({
      appId: "123",
      fetch: createMockFetch([
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/repos/acme/repo/issues/123/comments");
            expect(init?.body).toBe(
              JSON.stringify({
                body: "Created body",
              }),
            );
          },
          response: createJsonResponse({
            body: "Created body",
            html_url: "https://github.com/acme/repo/issues/123#issuecomment-3",
            id: 3,
            user: {
              login: "hackathon-testing-agent[bot]",
              type: "Bot",
            },
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/app/installations/99/access_tokens");
          },
          response: createJsonResponse({
            expires_at: "2099-03-18T01:00:00.000Z",
            token: "installation-token",
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("PATCH");
            expect(url).toContain("/repos/acme/repo/issues/comments/3");
            expect(init?.body).toBe(
              JSON.stringify({
                body: "Updated body",
              }),
            );
          },
          response: createJsonResponse({
            body: "Updated body",
            html_url: "https://github.com/acme/repo/issues/123#issuecomment-3",
            id: 3,
            user: {
              login: "hackathon-testing-agent[bot]",
              type: "Bot",
            },
          }),
        },
      ]),
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const created = await client.createIssueComment({
      body: "Created body",
      event,
      issueNumber: 123,
    });
    const updated = await client.updateIssueComment({
      body: "Updated body",
      commentId: 3,
      event,
    });

    expect(created.commentId).toBe(3);
    expect(updated).toEqual({
      authorLogin: "hackathon-testing-agent[bot]",
      body: "Updated body",
      commentId: 3,
      htmlUrl: "https://github.com/acme/repo/issues/123#issuecomment-3",
    });
  });
});
