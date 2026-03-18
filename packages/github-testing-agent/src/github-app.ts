import { createSign } from "node:crypto";

import { resolveAttachedIssueReference, selectReviewDiffSnippets } from "./context";
import type {
  ExistingIssueFeedbackComment,
  IssueContext,
  NormalizedTestingPullRequestWebhookEvent,
  PullRequestReviewContext,
  PullRequestReviewContextLoader,
  TestingPullRequestChangedFile,
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

interface GitHubIssueResponse {
  body?: string | null;
  html_url?: string;
  number?: number;
  state?: string;
  title?: string;
}

interface GitHubIssueCommentResponse {
  body?: string | null;
  html_url?: string;
  id?: number;
  user?: {
    login?: string;
    type?: string;
  };
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
  let normalized = privateKey.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (
    normalized.includes("BEGIN PRIVATE KEY") &&
    normalized.includes("END PRIVATE KEY") &&
    !normalized.endsWith("\n")
  ) {
    normalized += "\n";
  }

  return normalized;
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

function asStringRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
    headers.set("User-Agent", "hackathon-github-testing-agent");
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

function assertInstallationId(
  event: NormalizedTestingPullRequestWebhookEvent,
): number {
  if (event.installationId === null) {
    throw new Error(
      `GitHub App installation id is required for PR #${event.pullRequest.number}.`,
    );
  }

  return event.installationId;
}

function mapPullRequestFile(
  file: GitHubPullRequestFileResponse,
): TestingPullRequestChangedFile {
  const rawStatus = readString(file.status, "modified");
  const changeType: TestingPullRequestChangedFile["changeType"] =
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

function mapIssue(response: GitHubIssueResponse): IssueContext {
  const state = readString(response.state);

  return {
    body: readString(response.body),
    htmlUrl: readString(response.html_url),
    number: readNumber(response.number),
    state: state === "open" || state === "closed" ? state : "unknown",
    title: readString(response.title),
  };
}

function isBotComment(comment: GitHubIssueCommentResponse): boolean {
  const login = readString(comment.user?.login);
  const type = readString(comment.user?.type);

  return type === "Bot" || login.endsWith("[bot]");
}

function findExistingIssueFeedbackComment(params: {
  comments: GitHubIssueCommentResponse[];
  event: NormalizedTestingPullRequestWebhookEvent;
}): ExistingIssueFeedbackComment | null {
  const markerByNumber = `<!-- github-testing-agent:source-pr-number=${params.event.pullRequest.number} -->`;
  const markerByUrl = `<!-- github-testing-agent:source-pr-url=${params.event.pullRequest.htmlUrl} -->`;

  for (const comment of params.comments) {
    if (!isBotComment(comment)) {
      continue;
    }

    const body = readString(comment.body);

    if (
      !body.includes(markerByNumber) &&
      !body.includes(markerByUrl) &&
      !body.includes(params.event.pullRequest.htmlUrl)
    ) {
      continue;
    }

    return {
      authorLogin: readString(comment.user?.login),
      body,
      commentId: readNumber(comment.id),
      htmlUrl: readString(comment.html_url),
    };
  }

  return null;
}

async function getAttachedIssue(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  issueNumber: number;
  repository: NormalizedTestingPullRequestWebhookEvent["repository"];
}): Promise<IssueContext | null> {
  try {
    const response = await params.apiClient.requestJson<GitHubIssueResponse>({
      auth: "installation",
      pathname: `/repos/${params.repository.owner}/${params.repository.name}/issues/${params.issueNumber}`,
    });

    return mapIssue(response);
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function getIssueComments(params: {
  apiClient: ReturnType<typeof createGitHubAppApiClient>;
  issueNumber: number;
  repository: NormalizedTestingPullRequestWebhookEvent["repository"];
}): Promise<GitHubIssueCommentResponse[]> {
  const comments: GitHubIssueCommentResponse[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const pageComments =
      await params.apiClient.requestJson<GitHubIssueCommentResponse[]>({
        auth: "installation",
        pathname:
          `/repos/${params.repository.owner}/${params.repository.name}/issues/${params.issueNumber}/comments` +
          `?per_page=100&page=${page}`,
      });

    comments.push(...pageComments);

    if (pageComments.length < 100) {
      break;
    }
  }

  return comments;
}

export function createGitHubAppPullRequestReviewContextLoader(params: {
  appId: string;
  fetch?: FetchLike;
  privateKey: string;
}): PullRequestReviewContextLoader {
  return async (
    event: NormalizedTestingPullRequestWebhookEvent,
  ): Promise<PullRequestReviewContext> => {
    const installationId = assertInstallationId(event);
    const apiClient = createGitHubAppApiClient({
      appId: params.appId,
      fetch: params.fetch,
      installationId,
      privateKey: params.privateKey,
    });
    const changedFiles: TestingPullRequestChangedFile[] = [];

    for (let page = 1; page <= 10; page += 1) {
      const files = await apiClient.requestJson<GitHubPullRequestFileResponse[]>( {
        auth: "installation",
        pathname:
          `/repos/${event.repository.owner}/${event.repository.name}/pulls/${event.pullRequest.number}/files` +
          `?per_page=100&page=${page}`,
      });

      changedFiles.push(...files.map(mapPullRequestFile));

      if (files.length < 100) {
        break;
      }
    }

    const attachedIssueResolution = resolveAttachedIssueReference({
      body: event.pullRequest.body,
      repository: event.repository,
      title: event.pullRequest.title,
    });
    let attachedIssueReference = attachedIssueResolution.reference;
    let attachedIssue: IssueContext | null = null;
    let existingFeedbackComment: ExistingIssueFeedbackComment | null = null;
    let issueSelectionRationale = attachedIssueResolution.issueSelectionRationale;

    if (attachedIssueResolution.references.length > 0) {
      for (const reference of attachedIssueResolution.references) {
        const resolvedIssue = await getAttachedIssue({
          apiClient,
          issueNumber: reference.number,
          repository: event.repository,
        });

        if (!resolvedIssue) {
          continue;
        }

        attachedIssueReference = reference;
        attachedIssue = resolvedIssue;
        issueSelectionRationale =
          attachedIssueResolution.references.length === 1
            ? `Selected issue #${reference.number} from the ${reference.source}.`
            : `Selected issue #${reference.number} from the ${reference.source} as the first resolvable reference. ` +
              `All parsed references: ${attachedIssueResolution.references.map((item) => `#${item.number}`).join(", ")}.`;
        break;
      }

      if (attachedIssue) {
        const comments = await getIssueComments({
          apiClient,
          issueNumber: attachedIssue.number,
          repository: event.repository,
        });

        existingFeedbackComment = findExistingIssueFeedbackComment({
          comments,
          event,
        });
      } else if (attachedIssueReference) {
        issueSelectionRationale =
          `Parsed issue reference ${attachedIssueResolution.references.map((item) => `#${item.number}`).join(", ")}, ` +
          "but none of the referenced issues could be loaded from GitHub.";
      }
    }

    return {
      attachedIssue,
      attachedIssueReference,
      changedFiles,
      diffSnippets: selectReviewDiffSnippets(changedFiles),
      existingFeedbackComment,
      issueSelectionRationale,
      pullRequestBody: event.pullRequest.body,
      pullRequestTitle: event.pullRequest.title,
    };
  };
}
