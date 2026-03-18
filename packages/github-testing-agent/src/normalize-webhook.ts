import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  SUPPORTED_GITHUB_WEBHOOK_EVENTS,
  SUPPORTED_PULL_REQUEST_ACTIONS,
  TESTING_BOT_BRANCH_PREFIX,
} from "./constants";
import type {
  GitHubWebhookHeaders,
  GitHubWebhookNormalizationResult,
  GitHubWebhookSignatureVerificationResult,
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
    body: z.string().nullable().optional(),
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
    user: z.object({
      login: z.string(),
    }),
  }),
  repository: z.object({
    default_branch: z.string(),
    full_name: z.string(),
    name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  }),
  sender: z.object({
    login: z.string(),
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

function createGitHubWebhookSignature(payloadText: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(payloadText).digest("hex");

  return `sha256=${digest}`;
}

function isLikelyBotLogin(login: string): boolean {
  return login === "testing-bot" || login.endsWith("[bot]");
}

export function readGitHubWebhookHeaders(headers: Headers): GitHubWebhookHeaders {
  return {
    deliveryId: headers.get("x-github-delivery"),
    eventName: headers.get("x-github-event"),
    signature256: headers.get("x-hub-signature-256"),
  };
}

export function verifyGitHubWebhookSignature(params: {
  payloadText: string;
  secret: string | null | undefined;
  signature256: string | null;
}): GitHubWebhookSignatureVerificationResult | null {
  const { payloadText, secret, signature256 } = params;

  if (!secret) {
    return {
      ok: false,
      code: "webhook_secret_not_configured",
      message: "GitHub webhook verification is not configured.",
    };
  }

  if (!signature256) {
    return {
      ok: false,
      code: "missing_signature",
      message: "Missing X-Hub-Signature-256 header.",
    };
  }

  const expected = Buffer.from(createGitHubWebhookSignature(payloadText, secret));
  const actual = Buffer.from(signature256);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return {
      ok: false,
      code: "signature_mismatch",
      message: "GitHub webhook signature verification failed.",
    };
  }

  return null;
}

export function normalizeGitHubTestingWebhookEvent(params: {
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
      message: `pull_request action "${parsedPayload.data.action}" is not handled by the testing agent.`,
    };
  }

  const author = parsedPayload.data.pull_request.user.login;
  const headRef = parsedPayload.data.pull_request.head.ref;

  if (headRef.startsWith(TESTING_BOT_BRANCH_PREFIX)) {
    return {
      ok: false,
      code: "ignored_bot_branch",
      message: `Ignored bot branch "${headRef}" to prevent webhook loops.`,
    };
  }

  if (isLikelyBotLogin(author)) {
    return {
      ok: false,
      code: "ignored_bot_author",
      message: `Ignored bot-authored pull request from "${author}".`,
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
        author,
        baseRef: parsedPayload.data.pull_request.base.ref,
        body: parsedPayload.data.pull_request.body ?? "",
        draft: parsedPayload.data.pull_request.draft,
        headRef,
        htmlUrl: parsedPayload.data.pull_request.html_url,
        number: parsedPayload.data.pull_request.number,
        title: parsedPayload.data.pull_request.title,
      },
      sender: {
        login: parsedPayload.data.sender.login,
      },
      receivedAt: receivedAt.toISOString(),
    },
  };
}
