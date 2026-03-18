import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    GITHUB_APP_ID: z.string().min(1).optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
    GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
    GITHUB_REPO_OWNER: z.string().min(1).optional(),
    GITHUB_REPO_NAME: z.string().min(1).optional(),
    DOCS_AGENT_MODEL: z.string().min(1).optional(),
    DOCS_AGENT_DOCS_ROOT: z.string().min(1).default("apps/fumadocs/content/docs"),
    DOCS_AGENT_BASE_BRANCH: z.string().min(1).default("main"),
    DOCS_AGENT_DRY_RUN: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    GITHUB_DOC_AGENT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    GITHUB_DOC_AGENT_MODE: z.enum(["dry-run", "live"]).default("dry-run"),
    TESTING_AGENT_MODEL: z.string().min(1).optional(),
    GITHUB_TESTING_AGENT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    GITHUB_TESTING_AGENT_MODE: z.enum(["dry-run", "live"]).default("dry-run"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
