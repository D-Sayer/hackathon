import { createSign } from "node:crypto";

import type {
  GeneratedDocFileOperation,
  GitHubDocsPullRequestReference,
  GitHubDocsWritebackClient,
  NormalizedPullRequestWebhookEvent,
  PullRequestChangedFile,
  PullRequestContextLoader,
} from "./types";

type FetchLike = typeof fetch;

class GitHubApiError extends Error {
  responseBody: unknown;
  status: number;

  constructor(message: string, params: { responseBody: unknown; status: number }) {
    super(message);
    this.name = "GitHubApiError";
    this.responseBody = params.responseBody;
    this.status = params.status;
  }
}

interface GitHubAppClientParams {
  appId: string;
  fetch?: FetchLike;
  installationId: number;
  privateKey: string;
}

interface GitHubTokenResponse {
  expires_at: string;
  token: string;
}

interface GitHubRefResponse {
  object?: {
    sha?: string;
  };
}

interface GitHubCommitResponse {
  sha?: string;
  tree?: {
    sha?: string;
  };
}

interface GitHubBlobResponse {
  sha?: string;
}

interface GitHubTreeResponse {
  sha?: string;
}

interface GitHubContentsResponse {
  content?: string;
  sha?: string;
}

interface GitHubPullRequestResponse {
  base?: {
    ref?: string;
  };
  body?: string | null;
  draft?: boolean;
  head?: {
    ref?: string;
  };
  html_url?: string;
  number?: number;
  title?: string;
}

interface GitHubPullRequestFileResponse {
  additions?: number;
  deletions?: number;
  filename?: string;
  patch?: string;
  previous_filename?: string;
  status?: string;
}

function normalizePrivateKey(privateKey: string): string {
  return privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function createGitHubAppJwt(params: { appId: string; privateKey: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
  }));
  const payload = encodeBase64Url(JSON.stringify({
    exp: now + 9 * 60,
    iat: now - 60,
    iss: params.appId,
  }));
  const signer = createSign("RSA-SHA256");
  const signingInput = `${header}.${payload}`;

  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(normalizePrivateKey(params.privateKey), "base64url");

  return `${signingInput}.${signature}`;
}

function encodeRepoPath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function asStringRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function mapPullRequestReference(
  pullRequest: GitHubPullRequestResponse,
): GitHubDocsPullRequestReference {
  return {
    baseBranch: readString(pullRequest.base?.ref),
    body: readString(pullRequest.body),
    headBranch: readString(pullRequest.head?.ref),
    htmlUrl: readString(pullRequest.html_url),
    isDraft: Boolean(pullRequest.draft),
    number: readNumber(pullRequest.number),
    title: readString(pullRequest.title),
  };
}

function mapPullRequestFile(
  file: GitHubPullRequestFileResponse,
): PullRequestChangedFile {
  const rawStatus = readString(file.status, "modified");
  const changeType: PullRequestChangedFile["changeType"] =
    rawStatus === "added" ||
    rawStatus === "removed" ||
    rawStatus === "modified" ||
    rawStatus === "renamed"
      ? rawStatus
      : "modified";

  return {
    additions: readNumber(file.additions),
    changeType,
    deletions: readNumber(file.deletions),
    path: readString(file.filename),
    patch: typeof file.patch === "string" ? file.patch : undefined,
    previousPath:
      typeof file.previous_filename === "string"
        ? file.previous_filename
        : null,
  };
}

function decodeGitHubFileContent(content: string): string {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function buildGitHubApiErrorMessage(
  method: string,
  pathname: string,
  status: number,
  responseBody: unknown,
): string {
  const bodyRecord = asStringRecord(responseBody);
  const message = readString(bodyRecord.message);

  return message.length > 0
    ? `GitHub API ${method} ${pathname} failed (${status}): ${message}`
    : `GitHub API ${method} ${pathname} failed (${status}).`;
}

function createGitHubAppApiClient(params: GitHubAppClientParams) {
  const fetchImpl = params.fetch ?? fetch;
  let tokenCache: { expiresAt: number; token: string } | null = null;

  async function requestJson<T>(input: {
    auth: "app" | "installation";
    init?: RequestInit;
    pathname: string;
  }): Promise<T> {
    const headers = new Headers(input.init?.headers);

    headers.set("Accept", "application/vnd.github+json");
    headers.set("Content-Type", "application/json");
    headers.set("User-Agent", "hackathon-github-doc-agent");
    headers.set("X-GitHub-Api-Version", "2022-11-28");

    headers.set(
      "Authorization",
      `Bearer ${input.auth === "app" ? createGitHubAppJwt(params) : await getInstallationToken()}`,
    );

    const response = await fetchImpl(`https://api.github.com${input.pathname}`, {
      ...input.init,
      headers,
    });
    const responseText = await response.text();
    const responseBody =
      responseText.length > 0 ? safeJsonParse(responseText) : null;

    if (!response.ok) {
      throw new GitHubApiError(
        buildGitHubApiErrorMessage(
          input.init?.method ?? "GET",
          input.pathname,
          response.status,
          responseBody,
        ),
        {
          responseBody,
          status: response.status,
        },
      );
    }

    return responseBody as T;
  }

  async function getInstallationToken(): Promise<string> {
    if (tokenCache && tokenCache.expiresAt - Date.now() > 60_000) {
      return tokenCache.token;
    }

    const tokenResponse = await requestJson<GitHubTokenResponse>({
      auth: "app",
      init: {
        method: "POST",
      },
      pathname: `/app/installations/${params.installationId}/access_tokens`,
    });

    tokenCache = {
      expiresAt: new Date(tokenResponse.expires_at).getTime(),
      token: tokenResponse.token,
    };

    return tokenResponse.token;
  }

  return {
    requestJson,
  };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function getBranchHeadCommit(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  branchName: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
}): Promise<string | null> {
  try {
    const response = await params.apiClient.requestJson<GitHubRefResponse>({
      auth: "installation",
      pathname: `/repos/${params.repository.owner}/${params.repository.name}/git/ref/heads/${encodeRepoPath(params.branchName)}`,
    });

    return readString(response.object?.sha) || null;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function getCommitTreeSha(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  commitSha: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
}): Promise<string> {
  const response = await params.apiClient.requestJson<GitHubCommitResponse>({
    auth: "installation",
    pathname: `/repos/${params.repository.owner}/${params.repository.name}/git/commits/${params.commitSha}`,
  });
  const treeSha = readString(response.tree?.sha);

  if (treeSha.length === 0) {
    throw new Error(`GitHub did not return a tree SHA for commit ${params.commitSha}.`);
  }

  return treeSha;
}

async function getFileOnBranch(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  branchName: string;
  path: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
}): Promise<null | { content: string; sha: string }> {
  try {
    const response = await params.apiClient.requestJson<GitHubContentsResponse>({
      auth: "installation",
      pathname:
        `/repos/${params.repository.owner}/${params.repository.name}/contents/${encodeRepoPath(params.path)}` +
        `?ref=${encodeURIComponent(params.branchName)}`,
    });
    const content = readString(response.content);
    const sha = readString(response.sha);

    if (content.length === 0 || sha.length === 0) {
      return null;
    }

    return {
      content: decodeGitHubFileContent(content),
      sha,
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function createBlob(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  content: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
}): Promise<string> {
  const response = await params.apiClient.requestJson<GitHubBlobResponse>({
    auth: "installation",
    init: {
      body: JSON.stringify({
        content: params.content,
        encoding: "utf-8",
      }),
      method: "POST",
    },
    pathname: `/repos/${params.repository.owner}/${params.repository.name}/git/blobs`,
  });
  const sha = readString(response.sha);

  if (sha.length === 0) {
    throw new Error("GitHub did not return a blob SHA.");
  }

  return sha;
}

async function createTree(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  baseTreeSha: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
  tree: Array<{ path: string; sha: string }>;
}): Promise<string> {
  const response = await params.apiClient.requestJson<GitHubTreeResponse>({
    auth: "installation",
    init: {
      body: JSON.stringify({
        base_tree: params.baseTreeSha,
        tree: params.tree.map((entry) => ({
          mode: "100644",
          path: entry.path,
          sha: entry.sha,
          type: "blob",
        })),
      }),
      method: "POST",
    },
    pathname: `/repos/${params.repository.owner}/${params.repository.name}/git/trees`,
  });
  const sha = readString(response.sha);

  if (sha.length === 0) {
    throw new Error("GitHub did not return a tree SHA.");
  }

  return sha;
}

async function createCommit(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  message: string;
  parentSha: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
  treeSha: string;
}): Promise<string> {
  const response = await params.apiClient.requestJson<GitHubCommitResponse>({
    auth: "installation",
    init: {
      body: JSON.stringify({
        message: params.message,
        parents: [params.parentSha],
        tree: params.treeSha,
      }),
      method: "POST",
    },
    pathname: `/repos/${params.repository.owner}/${params.repository.name}/git/commits`,
  });
  const sha = readString(response.sha);

  if (sha.length === 0) {
    throw new Error("GitHub did not return a commit SHA.");
  }

  return sha;
}

async function updateBranchRef(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  branchName: string;
  commitSha: string;
  repository: NormalizedPullRequestWebhookEvent["repository"];
}): Promise<void> {
  await params.apiClient.requestJson<Record<string, unknown>>({
    auth: "installation",
    init: {
      body: JSON.stringify({
        force: false,
        sha: params.commitSha,
      }),
      method: "PATCH",
    },
    pathname: `/repos/${params.repository.owner}/${params.repository.name}/git/refs/heads/${encodeRepoPath(params.branchName)}`,
  });
}

function assertInstallationId(
  event: NormalizedPullRequestWebhookEvent,
): number {
  if (event.installationId === null) {
    throw new Error(
      `GitHub App installation id is required for PR #${event.pullRequest.number}.`,
    );
  }

  return event.installationId;
}

export function createGitHubAppPullRequestContextLoader(params: {
  appId: string;
  fetch?: FetchLike;
  privateKey: string;
}): PullRequestContextLoader {
  return async (event) => {
    const installationId = assertInstallationId(event);
    const apiClient = createGitHubAppApiClient({
      appId: params.appId,
      fetch: params.fetch,
      installationId,
      privateKey: params.privateKey,
    });
    const changedFiles: PullRequestChangedFile[] = [];

    for (let page = 1; page <= 10; page += 1) {
      const files = await apiClient.requestJson<GitHubPullRequestFileResponse[]>({
        auth: "installation",
        pathname:
          `/repos/${event.repository.owner}/${event.repository.name}/pulls/${event.pullRequest.number}/files` +
          `?per_page=100&page=${page}`,
      });

      for (const file of files) {
        changedFiles.push(mapPullRequestFile(file));
      }

      if (files.length < 100) {
        break;
      }
    }

    return {
      body: event.pullRequest.body,
      changedFiles,
      labels: [],
      title: event.pullRequest.title,
    };
  };
}

export function createGitHubAppDocsWritebackClient(
  params: GitHubAppClientParams,
): GitHubDocsWritebackClient {
  const apiClient = createGitHubAppApiClient(params);

  return {
    commitDocsChanges: async (input) => {
      const branchHeadSha = await getBranchHeadCommit({
        apiClient,
        branchName: input.branchName,
        repository: input.repository,
      });

      if (!branchHeadSha) {
        throw new Error(`GitHub branch ${input.branchName} does not exist.`);
      }

      const baseTreeSha = await getCommitTreeSha({
        apiClient,
        commitSha: branchHeadSha,
        repository: input.repository,
      });
      const changedOperations: GeneratedDocFileOperation[] = [];

      for (const operation of input.operations) {
        const currentFile = await getFileOnBranch({
          apiClient,
          branchName: input.branchName,
          path: operation.path,
          repository: input.repository,
        });

        if (currentFile?.content === operation.content) {
          continue;
        }

        changedOperations.push(operation);
      }

      if (changedOperations.length === 0) {
        return {
          commitSha: null,
          contentChanged: false,
        };
      }

      const treeEntries = [];

      for (const operation of changedOperations) {
        const blobSha = await createBlob({
          apiClient,
          content: operation.content,
          repository: input.repository,
        });

        treeEntries.push({
          path: operation.path,
          sha: blobSha,
        });
      }

      const treeSha = await createTree({
        apiClient,
        baseTreeSha,
        repository: input.repository,
        tree: treeEntries,
      });
      const commitSha = await createCommit({
        apiClient,
        message: input.commitMessage,
        parentSha: branchHeadSha,
        repository: input.repository,
        treeSha,
      });

      await updateBranchRef({
        apiClient,
        branchName: input.branchName,
        commitSha,
        repository: input.repository,
      });

      return {
        commitSha,
        contentChanged: true,
      };
    },
    createBranch: async (input) => {
      const baseHeadSha = await getBranchHeadCommit({
        apiClient,
        branchName: input.fromBranch,
        repository: input.repository,
      });

      if (!baseHeadSha) {
        throw new Error(`GitHub base branch ${input.fromBranch} does not exist.`);
      }

      try {
        await apiClient.requestJson<Record<string, unknown>>({
          auth: "installation",
          init: {
            body: JSON.stringify({
              ref: `refs/heads/${input.branchName}`,
              sha: baseHeadSha,
            }),
            method: "POST",
          },
          pathname: `/repos/${input.repository.owner}/${input.repository.name}/git/refs`,
        });
      } catch (error) {
        if (
          error instanceof GitHubApiError &&
          error.status === 422 &&
          readString(asStringRecord(error.responseBody).message).includes(
            "Reference already exists",
          )
        ) {
          const existingBranch = await getBranchHeadCommit({
            apiClient,
            branchName: input.branchName,
            repository: input.repository,
          });

          if (existingBranch) {
            return {
              name: input.branchName,
              sha: existingBranch,
            };
          }
        }

        throw error;
      }

      return {
        name: input.branchName,
        sha: baseHeadSha,
      };
    },
    createDraftPullRequest: async (input) => {
      const response = await apiClient.requestJson<GitHubPullRequestResponse>({
        auth: "installation",
        init: {
          body: JSON.stringify({
            base: input.baseBranch,
            body: input.body,
            draft: true,
            head: input.branchName,
            title: input.title,
          }),
          method: "POST",
        },
        pathname: `/repos/${input.repository.owner}/${input.repository.name}/pulls`,
      });

      return mapPullRequestReference(response);
    },
    findOpenPullRequest: async (input) => {
      const response = await apiClient.requestJson<GitHubPullRequestResponse[]>({
        auth: "installation",
        pathname:
          `/repos/${input.repository.owner}/${input.repository.name}/pulls` +
          `?state=open&head=${encodeURIComponent(`${input.repository.owner}:${input.branchName}`)}` +
          `&base=${encodeURIComponent(input.baseBranch)}&per_page=100`,
      });

      return response.length > 0 ? mapPullRequestReference(response[0]!) : null;
    },
    getBranch: async (input) => {
      const sha = await getBranchHeadCommit({
        apiClient,
        branchName: input.branchName,
        repository: input.repository,
      });

      return sha
        ? {
            name: input.branchName,
            sha,
          }
        : null;
    },
    updatePullRequest: async (input) => {
      const response = await apiClient.requestJson<GitHubPullRequestResponse>({
        auth: "installation",
        init: {
          body: JSON.stringify({
            base: input.baseBranch,
            body: input.body,
            title: input.title,
          }),
          method: "PATCH",
        },
        pathname: `/repos/${input.repository.owner}/${input.repository.name}/pulls/${input.pullRequestNumber}`,
      });

      return mapPullRequestReference(response);
    },
  };
}
