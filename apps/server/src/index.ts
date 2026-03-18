import { openai } from "@ai-sdk/openai";
import { createContext } from "@hackathon/api/context";
import { appRouter } from "@hackathon/api/routers/index";
import { auth } from "@hackathon/auth";
import { env } from "@hackathon/env/server";
import {
  createAiPullRequestClassifier,
  createAiPullRequestDocWriter,
} from "@hackathon/github-doc-agent";
import { createAiPullRequestReviewAnalyzer } from "@hackathon/github-testing-agent";
import { trpcServer } from "@hono/trpc-server";
import { streamText, convertToModelMessages, wrapLanguageModel } from "ai";
import { createApp } from "./app";

const docsAgentModel = openai(
  env.DOCS_AGENT_MODEL ?? "gpt-4.1-mini-2025-04-14",
);
const testingAgentModel = openai(
  env.TESTING_AGENT_MODEL ?? "gpt-4.1-mini-2025-04-14",
);

const app = createApp(env, {
  pullRequestClassifier: createAiPullRequestClassifier({
    model: docsAgentModel,
  }),
  pullRequestDocWriter: createAiPullRequestDocWriter({
    model: docsAgentModel,
  }),
  pullRequestReviewAnalyzer: createAiPullRequestReviewAnalyzer({
    model: testingAgentModel,
  }),
});

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

app.post("/ai", async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages || [];
  const { devToolsMiddleware } = await import("@ai-sdk/devtools");
  const model = wrapLanguageModel({
    model: openai("gpt-5.2-chat-latest"),
    middleware: devToolsMiddleware(),
  });

  const result = streamText({
    model,
    messages: await convertToModelMessages(uiMessages),
  });

  return result.toUIMessageStreamResponse();
});

export default app;
