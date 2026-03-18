import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "bun:test";

import {
  createGitHubAppDocsWritebackClient,
  createGitHubAppPullRequestContextLoader,
} from "./index";
import type { NormalizedPullRequestWebhookEvent } from "./index";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const event: NormalizedPullRequestWebhookEvent = {
  action: "opened",
  deliveryId: "delivery-1",
  eventName: "pull_request",
  installationId: 99,
  pullRequest: {
    author: "octocat",
    baseRef: "main",
    body: "Adds docs automation.",
    draft: false,
    headRef: "feature/docs-agent",
    htmlUrl: "https://github.com/acme/repo/pull/42",
    number: 42,
    title: "Add docs automation",
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

describe("github app integration", () => {
  test("loads pull request context from GitHub App APIs", async () => {
    const loader = createGitHubAppPullRequestContextLoader({
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
              filename: "apps/server/src/index.ts",
              patch: "@@ -1 +1 @@\n-old\n+new",
              status: "modified",
            },
            {
              additions: 4,
              deletions: 0,
              filename: "packages/github-doc-agent/src/workflow.ts",
              patch: "@@ -10 +10 @@\n-old\n+new",
              previous_filename: "packages/github-doc-agent/src/old-workflow.ts",
              status: "renamed",
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

    expect(context.title).toBe("Add docs automation");
    expect(context.body).toBe("Adds docs automation.");
    expect(context.labels).toEqual([]);
    expect(context.changedFiles).toEqual([
      {
        additions: 12,
        changeType: "modified",
        deletions: 3,
        path: "apps/server/src/index.ts",
        patch: "@@ -1 +1 @@\n-old\n+new",
        previousPath: null,
      },
      {
        additions: 4,
        changeType: "renamed",
        deletions: 0,
        path: "packages/github-doc-agent/src/workflow.ts",
        patch: "@@ -10 +10 @@\n-old\n+new",
        previousPath: "packages/github-doc-agent/src/old-workflow.ts",
      },
    ]);
  });

  test("skips creating a commit when the bot branch content already matches", async () => {
    const client = createGitHubAppDocsWritebackClient({
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
            expect(url).toContain("/git/ref/heads/docs-bot/pr-42");
          },
          response: createJsonResponse({
            object: {
              sha: "head-sha",
            },
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/git/commits/head-sha");
          },
          response: createJsonResponse({
            sha: "head-sha",
            tree: {
              sha: "tree-sha",
            },
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/contents/apps/fumadocs/content/docs/dashboard.mdx");
            expect(url).toContain("ref=docs-bot%2Fpr-42");
          },
          response: createJsonResponse({
            content: Buffer.from("same content").toString("base64"),
            sha: "file-sha",
          }),
        },
      ]),
      installationId: 99,
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const result = await client.commitDocsChanges({
      branchName: "docs-bot/pr-42",
      commitMessage: "docs: update documentation for #42",
      operations: [
        {
          content: "same content",
          path: "apps/fumadocs/content/docs/dashboard.mdx",
          previousContent: null,
          summary: "Create apps/fumadocs/content/docs/dashboard.mdx",
          type: "create",
        },
      ],
      repository: event.repository,
    });

    expect(result).toEqual({
      commitSha: null,
      contentChanged: false,
    });
  });

  test("creates a branch commit and draft PR through GitHub App APIs", async () => {
    const client = createGitHubAppDocsWritebackClient({
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
            expect(url).toContain("/git/ref/heads/main");
          },
          response: createJsonResponse({
            object: {
              sha: "main-sha",
            },
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/git/refs");
          },
          response: createJsonResponse({
            ref: "refs/heads/docs-bot/pr-42",
          }, {
            status: 201,
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/git/ref/heads/docs-bot/pr-42");
          },
          response: createJsonResponse({
            object: {
              sha: "branch-head-sha",
            },
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/git/commits/branch-head-sha");
          },
          response: createJsonResponse({
            tree: {
              sha: "base-tree-sha",
            },
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/contents/apps/fumadocs/content/docs/dashboard.mdx");
          },
          response: createJsonResponse({
            message: "Not Found",
          }, {
            status: 404,
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/git/blobs");
          },
          response: createJsonResponse({
            sha: "blob-sha",
          }, {
            status: 201,
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/git/trees");
          },
          response: createJsonResponse({
            sha: "tree-sha",
          }, {
            status: 201,
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/git/commits");
          },
          response: createJsonResponse({
            sha: "commit-sha",
          }, {
            status: 201,
          }),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("PATCH");
            expect(url).toContain("/git/refs/heads/docs-bot/pr-42");
          },
          response: createJsonResponse({
            ref: "refs/heads/docs-bot/pr-42",
          }),
        },
        {
          assert: ({ url }) => {
            expect(url).toContain("/pulls?state=open");
            expect(url).toContain("head=acme%3Adocs-bot%2Fpr-42");
          },
          response: createJsonResponse([]),
        },
        {
          assert: ({ init, url }) => {
            expect(init?.method).toBe("POST");
            expect(url).toContain("/pulls");
          },
          response: createJsonResponse({
            base: {
              ref: "main",
            },
            body: "Generated docs body",
            draft: true,
            head: {
              ref: "docs-bot/pr-42",
            },
            html_url: "https://github.com/acme/repo/pull/420",
            number: 420,
            title: "docs: update documentation for #42",
          }, {
            status: 201,
          }),
        },
      ]),
      installationId: 99,
      privateKey: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }).toString(),
    });

    const branch = await client.createBranch({
      branchName: "docs-bot/pr-42",
      fromBranch: "main",
      repository: event.repository,
    });
    const commit = await client.commitDocsChanges({
      branchName: "docs-bot/pr-42",
      commitMessage: "docs: update documentation for #42",
      operations: [
        {
          content: "new dashboard docs",
          path: "apps/fumadocs/content/docs/dashboard.mdx",
          previousContent: null,
          summary: "Create apps/fumadocs/content/docs/dashboard.mdx",
          type: "create",
        },
      ],
      repository: event.repository,
    });
    const existingPullRequest = await client.findOpenPullRequest({
      baseBranch: "main",
      branchName: "docs-bot/pr-42",
      repository: event.repository,
    });
    const createdPullRequest = await client.createDraftPullRequest({
      baseBranch: "main",
      body: "Generated docs body",
      branchName: "docs-bot/pr-42",
      repository: event.repository,
      title: "docs: update documentation for #42",
    });

    expect(branch).toEqual({
      name: "docs-bot/pr-42",
      sha: "main-sha",
    });
    expect(commit).toEqual({
      commitSha: "commit-sha",
      contentChanged: true,
    });
    expect(existingPullRequest).toBeNull();
    expect(createdPullRequest).toEqual({
      baseBranch: "main",
      body: "Generated docs body",
      headBranch: "docs-bot/pr-42",
      htmlUrl: "https://github.com/acme/repo/pull/420",
      isDraft: true,
      number: 420,
      title: "docs: update documentation for #42",
    });
  });
});
