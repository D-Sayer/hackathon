import type { PullRequestClassificationContext } from "../types";

function createContext(
  partial: Partial<PullRequestClassificationContext>,
): PullRequestClassificationContext {
  return {
    body: "",
    changedFiles: [],
    labels: [],
    title: "Update project",
    ...partial,
  };
}

export const webFeatureClassificationFixture = createContext({
  title: "Add dashboard quick filters",
  body: "Introduces new dashboard filter controls in the web app UI.",
  changedFiles: [
    {
      additions: 64,
      changeType: "modified",
      deletions: 8,
      path: "apps/web/src/routes/dashboard.tsx",
      patch:
        "@@ -10,4 +10,16 @@\n+export function DashboardFilters() {\n+  return <QuickFilters />;\n+}\n",
    },
    {
      additions: 22,
      changeType: "modified",
      deletions: 3,
      path: "apps/web/src/components/header.tsx",
      patch: "@@ -4,2 +4,6 @@\n+<button>Filter</button>\n",
    },
  ],
});

export const apiChangeClassificationFixture = createContext({
  title: "Add webhook replay endpoint",
  body: "Adds a new server route and request shape for replaying webhook payloads.",
  changedFiles: [
    {
      additions: 48,
      changeType: "modified",
      deletions: 2,
      path: "apps/server/src/index.ts",
      patch:
        "@@ -20,2 +20,12 @@\n+app.post('/api/webhooks/replay', async (c) => {\n+  return c.json({ ok: true });\n+});\n",
    },
    {
      additions: 18,
      changeType: "modified",
      deletions: 0,
      path: "packages/api/src/index.ts",
      patch: "@@ -1,2 +1,8 @@\n+export type ReplayWebhookRequest = {\n+  deliveryId: string;\n+};\n",
    },
  ],
});

export const internalRefactorClassificationFixture = createContext({
  title: "Internal refactor of auth utilities",
  body: "Cleanup only. No behavior change intended.",
  changedFiles: [
    {
      additions: 20,
      changeType: "modified",
      deletions: 20,
      path: "packages/auth/src/index.ts",
      patch:
        "@@ -5,8 +5,8 @@\n-export const oldHelper = () => {}\n+export const authHelper = () => {}\n",
    },
  ],
});

export const docsOnlyClassificationFixture = createContext({
  title: "Improve docs wording",
  body: "Tightens the getting started guide.",
  changedFiles: [
    {
      additions: 12,
      changeType: "modified",
      deletions: 5,
      path: "apps/fumadocs/content/docs/index.mdx",
      patch: "@@ -1,2 +1,2 @@\n-Old intro\n+New intro\n",
    },
    {
      additions: 5,
      changeType: "modified",
      deletions: 1,
      path: "README.md",
      patch: "@@ -1,2 +1,2 @@\n-Old text\n+New text\n",
    },
  ],
});

export const configChangeClassificationFixture = createContext({
  title: "Add GitHub docs agent setup env vars",
  body: "Adds setup instructions and environment handling for the docs agent.",
  changedFiles: [
    {
      additions: 14,
      changeType: "modified",
      deletions: 0,
      path: "packages/env/src/server.ts",
      patch:
        "@@ -8,2 +8,8 @@\n+DOCS_AGENT_MODEL: z.string().optional(),\n+GITHUB_WEBHOOK_SECRET: z.string().optional(),\n",
    },
    {
      additions: 9,
      changeType: "modified",
      deletions: 1,
      path: "apps/server/.env.example",
      patch: "@@ -1,2 +1,5 @@\n+DOCS_AGENT_MODEL=gpt-4.1\n",
    },
  ],
});
