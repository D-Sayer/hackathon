import {
  DOCS_WRITE_TARGET,
  createGitHubDocAgentWorkflowLogEntry,
  createGitHubAppDocsWritebackClient,
  createGitHubAppPullRequestContextLoader,
  createLocalDocsPageLoader,
  normalizeGitHubWebhookEvent,
  readGitHubWebhookHeaders,
  runGitHubDocAgentWorkflow,
  verifyGitHubWebhookSignature,
} from "@hackathon/github-doc-agent";
import type {
  DocsPageLoader,
  GitHubDocAgentWorkflowResult,
  PullRequestClassifier,
  PullRequestDocWriter,
  PullRequestContextLoader,
} from "@hackathon/github-doc-agent";
import {
  createGitHubAppPullRequestReviewContextLoader,
  createGitHubTestingAgentWorkflowLogEntry,
  normalizeGitHubTestingWebhookEvent,
  runGitHubTestingAgentWorkflow,
} from "@hackathon/github-testing-agent";
import type {
  GitHubTestingAgentWorkflowResult,
  PullRequestReviewAnalyzer,
  PullRequestReviewContextLoader,
} from "@hackathon/github-testing-agent";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export interface ServerEnv {
  CORS_ORIGIN: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_DOC_AGENT_ENABLED: boolean;
  GITHUB_DOC_AGENT_MODE: "dry-run" | "live";
  GITHUB_TESTING_AGENT_ENABLED: boolean;
  GITHUB_TESTING_AGENT_MODE: "dry-run" | "live";
  GITHUB_WEBHOOK_SECRET?: string;
}

interface CreateAppDependencies {
  createGitHubDocAgentWorkflowLogEntry?: typeof createGitHubDocAgentWorkflowLogEntry;
  createGitHubTestingAgentWorkflowLogEntry?: typeof createGitHubTestingAgentWorkflowLogEntry;
  docsPageLoader?: DocsPageLoader;
  normalizeGitHubTestingWebhookEvent?: typeof normalizeGitHubTestingWebhookEvent;
  normalizeGitHubWebhookEvent?: typeof normalizeGitHubWebhookEvent;
  pullRequestClassifier?: PullRequestClassifier;
  pullRequestContextLoader?: PullRequestContextLoader | null;
  pullRequestReviewAnalyzer?: PullRequestReviewAnalyzer;
  pullRequestReviewContextLoader?: PullRequestReviewContextLoader | null;
  pullRequestDocWriter?: PullRequestDocWriter;
  readGitHubWebhookHeaders?: typeof readGitHubWebhookHeaders;
  runGitHubDocAgentWorkflow?: typeof runGitHubDocAgentWorkflow;
  runGitHubTestingAgentWorkflow?: typeof runGitHubTestingAgentWorkflow;
  verifyGitHubWebhookSignature?: typeof verifyGitHubWebhookSignature;
}

function createSkippedDocsWorkflowResult(params: {
  message: string;
  sourcePrNumber: number;
}): GitHubDocAgentWorkflowResult {
  return {
    accepted: false,
    code: "workflow_not_configured",
    classification: {
      changedFilesConsidered: [],
      needsDocs: false,
      proposedChanges: [],
      rationale: params.message,
      source: "fallback",
      targetPages: [],
      wasModelSkipped: true,
    },
    docGeneration: null,
    docsWriteTarget: DOCS_WRITE_TARGET,
    message: params.message,
    sourcePrNumber: params.sourcePrNumber,
    writeback: null,
  };
}

export function createApp(
  appEnv: ServerEnv,
  dependencies: CreateAppDependencies = {},
) {
  const app = new Hono();
  const createDocsLogEntry =
    dependencies.createGitHubDocAgentWorkflowLogEntry ??
    createGitHubDocAgentWorkflowLogEntry;
  const createTestingLogEntry =
    dependencies.createGitHubTestingAgentWorkflowLogEntry ??
    createGitHubTestingAgentWorkflowLogEntry;
  const docsPageLoader =
    dependencies.docsPageLoader ??
    createLocalDocsPageLoader({
      cwd: process.cwd(),
    });
  const normalizeDocsEvent =
    dependencies.normalizeGitHubWebhookEvent ?? normalizeGitHubWebhookEvent;
  const normalizeTestingEvent =
    dependencies.normalizeGitHubTestingWebhookEvent ??
    normalizeGitHubTestingWebhookEvent;
  const pullRequestContextLoader =
    dependencies.pullRequestContextLoader ??
    (appEnv.GITHUB_APP_ID && appEnv.GITHUB_APP_PRIVATE_KEY
      ? createGitHubAppPullRequestContextLoader({
          appId: appEnv.GITHUB_APP_ID,
          privateKey: appEnv.GITHUB_APP_PRIVATE_KEY,
        })
      : null);
  const pullRequestReviewContextLoader =
    dependencies.pullRequestReviewContextLoader ??
    (appEnv.GITHUB_APP_ID && appEnv.GITHUB_APP_PRIVATE_KEY
      ? createGitHubAppPullRequestReviewContextLoader({
          appId: appEnv.GITHUB_APP_ID,
          privateKey: appEnv.GITHUB_APP_PRIVATE_KEY,
        })
      : null);
  const readWebhookHeaders =
    dependencies.readGitHubWebhookHeaders ?? readGitHubWebhookHeaders;
  const runDocsWorkflow =
    dependencies.runGitHubDocAgentWorkflow ?? runGitHubDocAgentWorkflow;
  const runTestingWorkflow =
    dependencies.runGitHubTestingAgentWorkflow ??
    runGitHubTestingAgentWorkflow;
  const verifySignature =
    dependencies.verifyGitHubWebhookSignature ?? verifyGitHubWebhookSignature;

  app.use(logger());
  app.use(
    "/*",
    cors({
      origin: appEnv.CORS_ORIGIN,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "User-Agent"],
      credentials: true,
    }),
  );

  app.get("/webhooks/github", (c) => {
    return c.redirect("/webhooks/github/health", 307);
  });

  app.get("/webhooks/github/health", (c) => {
    return c.json({
      docsWriteTarget: DOCS_WRITE_TARGET,
      docsAgent: {
        enabled: appEnv.GITHUB_DOC_AGENT_ENABLED,
        mode: appEnv.GITHUB_DOC_AGENT_MODE,
      },
      status: "ready",
      testingAgent: {
        enabled: appEnv.GITHUB_TESTING_AGENT_ENABLED,
        mode: appEnv.GITHUB_TESTING_AGENT_MODE,
      },
    });
  });

  app.post("/webhooks/github", async (c) => {
    const payloadText = await c.req.text();
    const headers = readWebhookHeaders(c.req.raw.headers);

    console.info("[github-webhook] intake", {
      deliveryId: headers.deliveryId,
      eventName: headers.eventName,
    });

    const signatureError = verifySignature({
      payloadText,
      secret: appEnv.GITHUB_WEBHOOK_SECRET,
      signature256: headers.signature256,
    });

    if (signatureError) {
      const status =
        signatureError.code === "webhook_secret_not_configured" ? 503 : 401;

      console.warn("[github-webhook] rejected", {
        code: signatureError.code,
        deliveryId: headers.deliveryId,
        eventName: headers.eventName,
      });

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

    const docsNormalization = normalizeDocsEvent({
      headers,
      payload,
    });
    const testingNormalization = normalizeTestingEvent({
      headers,
      payload,
    });

    if (!docsNormalization.ok) {
      console.info("[github-webhook] docs-agent-ignored", {
        code: docsNormalization.code,
        deliveryId: headers.deliveryId,
        eventName: headers.eventName,
      });
    }

    if (!testingNormalization.ok) {
      console.info("[github-webhook] testing-agent-ignored", {
        code: testingNormalization.code,
        deliveryId: headers.deliveryId,
        eventName: headers.eventName,
      });
    }

    if (
      !docsNormalization.ok &&
      !testingNormalization.ok &&
      (docsNormalization.code === "invalid_payload" ||
        testingNormalization.code === "invalid_payload")
    ) {
      return c.json(
        {
          code: "invalid_payload",
          docsAgent: docsNormalization,
          message:
            "GitHub webhook payload did not match the expected pull request shape.",
          testingAgent: testingNormalization,
        },
        400,
      );
    }

    if (!docsNormalization.ok && !testingNormalization.ok) {
      return c.json(
        {
          deliveryId: headers.deliveryId,
          docsAgent: docsNormalization,
          eventName: headers.eventName,
          testingAgent: testingNormalization,
        },
        202,
      );
    }

    const normalizedEvent = testingNormalization.ok
      ? testingNormalization.event
      : docsNormalization.ok
        ? docsNormalization.event
        : null;

    if (!normalizedEvent) {
      return c.json(
        {
          code: "workflow_execution_failed",
          message: "Expected a normalized webhook event before running workflows.",
        },
        503,
      );
    }

    const sourcePrNumber = normalizedEvent.pullRequest.number;
    let docsWorkflowResult: GitHubDocAgentWorkflowResult =
      createSkippedDocsWorkflowResult({
        message: docsNormalization.ok
          ? "The docs agent workflow was not run for this webhook."
          : docsNormalization.message,
        sourcePrNumber,
      });
    let testingWorkflowResult: GitHubTestingAgentWorkflowResult | null =
      testingNormalization.ok
        ? null
        : {
            accepted: false,
            analysis: {
              blastRadius: [],
              changedFilesConsidered: [],
              confidence: "low",
              implementationGaps: [],
              oversights: [],
              rationale: testingNormalization.message,
              shouldComment: false,
              source: "fallback",
              summary: testingNormalization.message,
              testingNotes: [],
              wasModelSkipped: true,
            },
            code: "workflow_not_configured",
            context: null,
            message: testingNormalization.message,
            sourcePrNumber,
          };

    try {
      if (docsNormalization.ok) {
        docsWorkflowResult = await runDocsWorkflow(
          {
            event: docsNormalization.event,
            mode: appEnv.GITHUB_DOC_AGENT_MODE,
          },
          {
            classifier: dependencies.pullRequestClassifier,
            docWriter: dependencies.pullRequestDocWriter,
            githubWritebackClient:
              docsNormalization.event.installationId !== null &&
              appEnv.GITHUB_APP_ID &&
              appEnv.GITHUB_APP_PRIVATE_KEY
                ? createGitHubAppDocsWritebackClient({
                    appId: appEnv.GITHUB_APP_ID,
                    installationId: docsNormalization.event.installationId,
                    privateKey: appEnv.GITHUB_APP_PRIVATE_KEY,
                  })
                : undefined,
            isConfigured:
              appEnv.GITHUB_DOC_AGENT_ENABLED &&
              pullRequestContextLoader !== null,
            loadDocsPages: docsPageLoader,
            loadPullRequestContext: pullRequestContextLoader ?? undefined,
          },
        );
      }

      if (testingNormalization.ok) {
        testingWorkflowResult = await runTestingWorkflow(
          {
            event: testingNormalization.event,
            mode: appEnv.GITHUB_TESTING_AGENT_MODE,
          },
          {
            analyzer: dependencies.pullRequestReviewAnalyzer,
            isConfigured:
              appEnv.GITHUB_TESTING_AGENT_ENABLED &&
              pullRequestReviewContextLoader !== null,
            loadPullRequestReviewContext:
              pullRequestReviewContextLoader ?? undefined,
          },
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown GitHub webhook workflow error.";

      console.error("[github-webhook] workflow-error", {
        deliveryId: normalizedEvent.deliveryId,
        message,
        sourcePrNumber: normalizedEvent.pullRequest.number,
      });

      return c.json(
        {
          code: "workflow_execution_failed",
          message,
        },
        503,
      );
    }

    if (docsNormalization.ok) {
      console.info(
        "[github-webhook] docs-workflow",
        createDocsLogEntry({
          event: docsNormalization.event,
          mode: appEnv.GITHUB_DOC_AGENT_MODE,
          result: docsWorkflowResult,
        }),
      );
    }

    if (testingNormalization.ok && testingWorkflowResult) {
      console.info(
        "[github-webhook] testing-workflow",
        createTestingLogEntry({
          event: testingNormalization.event,
          mode: appEnv.GITHUB_TESTING_AGENT_MODE,
          result: testingWorkflowResult,
        }),
      );
    }

    const status =
      docsWorkflowResult.accepted || testingWorkflowResult?.accepted ? 202 : 503;

    return c.json(
      {
        deliveryId: headers.deliveryId,
        docsAgent: docsNormalization.ok ? docsWorkflowResult : docsNormalization,
        eventName: headers.eventName,
        testingAgent: testingNormalization.ok
          ? testingWorkflowResult
          : testingNormalization,
      },
      status,
    );
  });

  app.get("/", (c) => {
    return c.text("OK");
  });

  return app;
}
