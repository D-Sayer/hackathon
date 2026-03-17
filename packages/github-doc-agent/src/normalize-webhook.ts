import { z } from "zod";

import {
  SUPPORTED_GITHUB_WEBHOOK_EVENTS,
  SUPPORTED_PULL_REQUEST_ACTIONS,
} from "./constants";
import type {
  GitHubWebhookHeaders,
  GitHubWebhookNormalizationResult,
  SupportedGitHubWebhookEvent,
  SupportedPullRequestAction,
} from "./types";

const webhookPayloadSchema = z.object({
  action: z.string(),
  installation: z
    .object({
      id: z.number(),
    })
    .nullable()
    .optional(),
  pull_request: z.object({
    base: z.object({
      ref: z.string(),
    }),
    draft: z.boolean(),
    head: z.object({
      ref: z.string(),
    }),
    html_url: z.url(),
    number: z.number(),
    title: z.string(),
  }),
  repository: z.object({
    default_branch: z.string(),
    full_name: z.string(),
    name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  }),
});

function isSupportedEventName(
  eventName: string | null,
): eventName is SupportedGitHubWebhookEvent {
  return (
    eventName !== null &&
    (SUPPORTED_GITHUB_WEBHOOK_EVENTS as readonly string[]).includes(eventName)
  );
}

function isSupportedPullRequestAction(
  action: string,
): action is SupportedPullRequestAction {
  return (SUPPORTED_PULL_REQUEST_ACTIONS as readonly string[]).includes(action);
}

export function readGitHubWebhookHeaders(headers: Headers): GitHubWebhookHeaders {
  return {
    deliveryId: headers.get("x-github-delivery"),
    eventName: headers.get("x-github-event"),
    signature256: headers.get("x-hub-signature-256"),
  };
}

export function normalizeGitHubWebhookEvent(params: {
  headers: GitHubWebhookHeaders;
  payload: unknown;
  receivedAt?: Date;
}): GitHubWebhookNormalizationResult {
  const { headers, payload, receivedAt = new Date() } = params;

  if (!isSupportedEventName(headers.eventName)) {
    return {
      ok: false,
      code: "unsupported_event",
      message: "Only pull_request webhooks are supported.",
    };
  }

  const parsedPayload = webhookPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "GitHub webhook payload did not match the expected pull request shape.",
    };
  }

  if (!isSupportedPullRequestAction(parsedPayload.data.action)) {
    return {
      ok: false,
      code: "unsupported_action",
      message: `pull_request action "${parsedPayload.data.action}" is not handled by the docs agent.`,
    };
  }

  return {
    ok: true,
    event: {
      action: parsedPayload.data.action,
      deliveryId: headers.deliveryId,
      eventName: headers.eventName,
      installationId: parsedPayload.data.installation?.id ?? null,
      repository: {
        defaultBranch: parsedPayload.data.repository.default_branch,
        fullName: parsedPayload.data.repository.full_name,
        name: parsedPayload.data.repository.name,
        owner: parsedPayload.data.repository.owner.login,
      },
      pullRequest: {
        baseRef: parsedPayload.data.pull_request.base.ref,
        draft: parsedPayload.data.pull_request.draft,
        headRef: parsedPayload.data.pull_request.head.ref,
        htmlUrl: parsedPayload.data.pull_request.html_url,
        number: parsedPayload.data.pull_request.number,
        title: parsedPayload.data.pull_request.title,
      },
      receivedAt: receivedAt.toISOString(),
    },
  };
}
