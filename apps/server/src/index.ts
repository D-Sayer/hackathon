import { devToolsMiddleware } from "@ai-sdk/devtools";
import { openai } from "@ai-sdk/openai";
import { createContext } from "@hackathon/api/context";
import { appRouter } from "@hackathon/api/routers/index";
import { auth } from "@hackathon/auth";
import { env } from "@hackathon/env/server";
import {
  DOCS_WRITE_TARGET,
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

  const workflowResult = await runGitHubDocAgentWorkflow(
    {
      event: normalization.event,
      mode: env.GITHUB_DOC_AGENT_MODE,
    },
    {
      isConfigured: env.GITHUB_DOC_AGENT_ENABLED,
    },
  );

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
