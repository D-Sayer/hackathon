import { devToolsMiddleware } from "@ai-sdk/devtools";
import { openai } from "@ai-sdk/openai";
import { createContext } from "@hackathon/api/context";
import { appRouter } from "@hackathon/api/routers/index";
import { auth } from "@hackathon/auth";
import { env } from "@hackathon/env/server";
import {
  DOCS_WRITE_TARGET,
  createAiPullRequestClassifier,
  createAiPullRequestDocWriter,
  createGitHubAppDocsWritebackClient,
  createGitHubAppPullRequestContextLoader,
  createLocalDocsPageLoader,
  normalizeGitHubWebhookEvent,
  readGitHubWebhookHeaders,
  runGitHubDocAgentWorkflow,
  verifyGitHubWebhookSignature,
} from "@hackathon/github-doc-agent";
import { trpcServer } from "@hono/trpc-server";
import { streamText, convertToModelMessages, wrapLanguageModel } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();
const docsAgentModel = openai(env.DOCS_AGENT_MODEL ?? "gpt-4.1-mini-2025-04-14");
const docsPageLoader = createLocalDocsPageLoader({
  cwd: process.cwd(),
});
const pullRequestClassifier = createAiPullRequestClassifier({
  model: docsAgentModel,
});
const pullRequestDocWriter = createAiPullRequestDocWriter({
  model: docsAgentModel,
});
const pullRequestContextLoader =
  env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY
    ? createGitHubAppPullRequestContextLoader({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      })
    : null;

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "User-Agent"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/webhooks/github", (c) => {
  return c.redirect("/webhooks/github/health", 307);
});

app.get("/webhooks/github/health", (c) => {
  return c.json({
    docsWriteTarget: DOCS_WRITE_TARGET,
    enabled: env.GITHUB_DOC_AGENT_ENABLED,
    mode: env.GITHUB_DOC_AGENT_MODE,
    status: "ready",
  });
});

app.post("/webhooks/github", async (c) => {
  const payloadText = await c.req.text();
  const headers = readGitHubWebhookHeaders(c.req.raw.headers);

  console.info("[github-webhook] intake", {
    deliveryId: headers.deliveryId,
    eventName: headers.eventName,
  });

  const signatureError = verifyGitHubWebhookSignature({
    payloadText,
    secret: env.GITHUB_WEBHOOK_SECRET,
    signature256: headers.signature256,
  });

  if (signatureError) {
    const status =
      signatureError.code === "webhook_secret_not_configured" ? 503 : 401;

    return c.json(signatureError, status);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadText);
  } catch {
    return c.json(
      {
        code: "invalid_json",
        message: "Webhook body must be valid JSON.",
      },
      400,
    );
  }

  const normalization = normalizeGitHubWebhookEvent({
    headers,
    payload,
  });

  if (!normalization.ok) {
    const status =
      normalization.code === "invalid_payload"
        ? 400
        : 202;

    return c.json(normalization, status);
  }

  let workflowResult;

  try {
    workflowResult = await runGitHubDocAgentWorkflow(
      {
        event: normalization.event,
        mode: env.GITHUB_DOC_AGENT_MODE,
      },
      {
        classifier: pullRequestClassifier,
        docWriter: pullRequestDocWriter,
        githubWritebackClient:
          normalization.event.installationId !== null &&
          env.GITHUB_APP_ID &&
          env.GITHUB_APP_PRIVATE_KEY
            ? createGitHubAppDocsWritebackClient({
                appId: env.GITHUB_APP_ID,
                installationId: normalization.event.installationId,
                privateKey: env.GITHUB_APP_PRIVATE_KEY,
              })
            : undefined,
        isConfigured:
          env.GITHUB_DOC_AGENT_ENABLED &&
          pullRequestContextLoader !== null,
        loadDocsPages: docsPageLoader,
        loadPullRequestContext: pullRequestContextLoader ?? undefined,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown GitHub docs workflow error.";

    console.error("[github-webhook] workflow-error", {
      deliveryId: normalization.event.deliveryId,
      message,
      sourcePrNumber: normalization.event.pullRequest.number,
    });

    return c.json(
      {
        code: "workflow_execution_failed",
        message,
      },
      503,
    );
  }

  const status = workflowResult.accepted ? 202 : 503;

  return c.json(
    {
      ...workflowResult,
      deliveryId: normalization.event.deliveryId,
      eventName: normalization.event.eventName,
    },
    status,
  );
});

app.post("/ai", async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages || [];
  const model = wrapLanguageModel({
    model: openai("gpt-4.1-2025-04-14"),
    middleware: devToolsMiddleware(),
  });

  const result = streamText({
    model,
    messages: await convertToModelMessages(uiMessages),
  });

  return result.toUIMessageStreamResponse();
});

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
