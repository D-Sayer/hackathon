import { DOCS_BOT_BRANCH_PREFIX } from "./constants";
import type {
  GitHubDocsWritebackClient,
  GitHubDocsWritebackFailure,
  GitHubDocsWritebackInput,
  GitHubDocsWritebackSummary,
  GitHubDocsPullRequestReference,
} from "./types";

function buildDocsBranchName(sourcePrNumber: number): string {
  return `${DOCS_BOT_BRANCH_PREFIX}${sourcePrNumber}`;
}

function resolveBaseBranch(input: GitHubDocsWritebackInput): string {
  return (
    input.event.pullRequest.baseRef.trim() ||
    input.event.repository.defaultBranch.trim() ||
    "main"
  );
}

function buildDocsTitle(sourcePrNumber: number): string {
  return `docs: update documentation for #${sourcePrNumber}`;
}

function buildDocsBody(input: GitHubDocsWritebackInput): string {
  const { pullRequest } = input.event;

  return [
    "## Summary",
    `This draft PR was generated from source PR [#${pullRequest.number}](${pullRequest.htmlUrl}).`,
    "",
    "## Source Pull Request",
    `- PR: [#${pullRequest.number}](${pullRequest.htmlUrl})`,
    `- Title: ${pullRequest.title}`,
    `- Source branch: \`${pullRequest.headRef}\``,
    "",
    "## Generated Docs Changes",
    ...input.operations.map((operation) => `- ${operation.summary}`),
  ].join("\n");
}

function normalizePullRequestResult(params: {
  action: "created" | "updated";
  body: string;
  reference: GitHubDocsPullRequestReference;
  title: string;
}): GitHubDocsWritebackSummary["pullRequest"] {
  return {
    action: params.action,
    body: params.body,
    htmlUrl: params.reference.htmlUrl,
    number: params.reference.number,
    title: params.title,
  };
}

export function createDocsWritebackMetadata(input: GitHubDocsWritebackInput): {
  baseBranch: string;
  body: string;
  branchName: string;
  commitMessage: string;
  title: string;
} {
  const baseBranch = resolveBaseBranch(input);
  const branchName = buildDocsBranchName(input.event.pullRequest.number);
  const title = buildDocsTitle(input.event.pullRequest.number);

  return {
    baseBranch,
    body: buildDocsBody(input),
    branchName,
    commitMessage: title,
    title,
  };
}

export async function runGitHubDocsWriteback(
  input: GitHubDocsWritebackInput,
  client: GitHubDocsWritebackClient,
): Promise<
  | {
      ok: true;
      writeback: GitHubDocsWritebackSummary;
    }
  | {
      ok: false;
      error: GitHubDocsWritebackFailure;
    }
> {
  const metadata = createDocsWritebackMetadata(input);
  const baseFailureState = {
    baseBranch: metadata.baseBranch,
    branchName: metadata.branchName,
  };

  let branchCreated = false;

  try {
    const existingBranch = await client.getBranch({
      branchName: metadata.branchName,
      repository: input.event.repository,
    });

    if (!existingBranch) {
      await client.createBranch({
        branchName: metadata.branchName,
        fromBranch: metadata.baseBranch,
        repository: input.event.repository,
      });
      branchCreated = true;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown branch writeback error.";

    return {
      error: {
        message: `GitHub docs writeback failed while preparing branch ${metadata.branchName}: ${message}`,
        stage: "branch",
        writeback: {
          ...baseFailureState,
          branchCreated,
          commitCreated: false,
          commitMessage: metadata.commitMessage,
          commitSha: null,
        },
      },
      ok: false,
    };
  }

  let commitSha: string | null = null;
  let commitCreated = false;

  try {
    const commitResult = await client.commitDocsChanges({
      branchName: metadata.branchName,
      commitMessage: metadata.commitMessage,
      operations: input.operations,
      repository: input.event.repository,
    });

    commitSha = commitResult.commitSha;
    commitCreated = commitResult.contentChanged;

    if (!commitResult.contentChanged) {
      return {
        ok: true,
        writeback: {
          ...baseFailureState,
          branchCreated,
          commitCreated: false,
          commitMessage: metadata.commitMessage,
          commitSha,
          pullRequest: null,
          status: "no_changes",
        },
      };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown commit writeback error.";

    return {
      error: {
        message: `GitHub docs writeback failed while committing branch ${metadata.branchName}: ${message}`,
        stage: "commit",
        writeback: {
          ...baseFailureState,
          branchCreated,
          commitCreated,
          commitMessage: metadata.commitMessage,
          commitSha,
        },
      },
      ok: false,
    };
  }

  try {
    const existingPullRequest = await client.findOpenPullRequest({
      baseBranch: metadata.baseBranch,
      branchName: metadata.branchName,
      repository: input.event.repository,
    });

    if (existingPullRequest) {
      const updatedPullRequest = await client.updatePullRequest({
        baseBranch: metadata.baseBranch,
        body: metadata.body,
        pullRequestNumber: existingPullRequest.number,
        repository: input.event.repository,
        title: metadata.title,
      });

      return {
        ok: true,
        writeback: {
          ...baseFailureState,
          branchCreated,
          commitCreated,
          commitMessage: metadata.commitMessage,
          commitSha,
          pullRequest: normalizePullRequestResult({
            action: "updated",
            body: metadata.body,
            reference: updatedPullRequest,
            title: metadata.title,
          }),
          status: "pull_request_updated",
        },
      };
    }

    const createdPullRequest = await client.createDraftPullRequest({
      baseBranch: metadata.baseBranch,
      body: metadata.body,
      branchName: metadata.branchName,
      repository: input.event.repository,
      title: metadata.title,
    });

    return {
      ok: true,
      writeback: {
        ...baseFailureState,
        branchCreated,
        commitCreated,
        commitMessage: metadata.commitMessage,
        commitSha,
        pullRequest: normalizePullRequestResult({
          action: "created",
          body: metadata.body,
          reference: createdPullRequest,
          title: metadata.title,
        }),
        status: "pull_request_created",
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown pull request writeback error.";

    return {
      error: {
        message: `GitHub docs writeback failed after updating branch ${metadata.branchName}: ${message}`,
        stage: "pull_request",
        writeback: {
          ...baseFailureState,
          branchCreated,
          commitCreated,
          commitMessage: metadata.commitMessage,
          commitSha,
        },
      },
      ok: false,
    };
  }
}
