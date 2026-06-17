import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { SystemRole } from "@ai-connect/shared";
import type {
  ProviderUsage,
  UsageRepository,
  UsageScope,
  WorkspaceUsage,
} from "@ai-connect/shared";
import { createUsageRoutes } from "./usage-routes.js";
import type {
  WorkspaceRepository,
  WorkspaceSummary,
} from "../workspace/workspace-repository.js";
import { createRequireAuth } from "../auth/auth-middleware.js";
import { createErrorHandler } from "../shared/error-handler.js";
import type { AppContainer } from "../container.js";
import type { Logger } from "../logger.js";

const ALL_WORKSPACES: WorkspaceSummary[] = [
  { id: "ws-1", slug: "alpha", name: "Alpha", createdAt: new Date() },
  { id: "ws-2", slug: "beta", name: "Beta", createdAt: new Date() },
];

// m1 belongs to ws-1 only; m9 belongs to nothing.
const USER_WORKSPACES = new Map<string, string[]>([["m1", ["ws-1"]]]);

function makeWorkspaceRepo(): WorkspaceRepository {
  return {
    listAll: async () => ({ items: ALL_WORKSPACES, total: ALL_WORKSPACES.length }),
    listForUser: async (userId: string) => {
      const ids = USER_WORKSPACES.get(userId) ?? [];
      const items = ALL_WORKSPACES.filter((w) => ids.includes(w.id));
      return { items, total: items.length };
    },
  } as unknown as WorkspaceRepository;
}

// Usage repo that honors scope so isolation can be asserted end-to-end.
const PROVIDER_ROWS: Array<ProviderUsage & { workspaceId: string }> = [
  { workspaceId: "ws-1", providerId: "p-anthropic", providerKind: "anthropic", inputTokens: 100, outputTokens: 40, totalTokens: 140, requestCount: 2 },
  { workspaceId: "ws-2", providerId: "p-openai", providerKind: "openai", inputTokens: 500, outputTokens: 200, totalTokens: 700, requestCount: 5 },
];
const WORKSPACE_ROWS: Array<WorkspaceUsage> = [
  { workspaceId: "ws-1", inputTokens: 100, outputTokens: 40, totalTokens: 140, requestCount: 2 },
  { workspaceId: "ws-2", inputTokens: 500, outputTokens: 200, totalTokens: 700, requestCount: 5 },
];

function inScope(workspaceId: string, scope: UsageScope): boolean {
  return scope === "all" || scope.includes(workspaceId);
}

function makeUsageRepo(): UsageRepository {
  return {
    record: async () => {},
    aggregateByProvider: async (scope: UsageScope) =>
      PROVIDER_ROWS.filter((r) => inScope(r.workspaceId, scope)).map(
        ({ workspaceId: _ws, ...row }) => row,
      ),
    aggregateByWorkspace: async (scope: UsageScope) =>
      WORKSPACE_ROWS.filter((r) => inScope(r.workspaceId, scope)),
  };
}

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
}

function makeApp(caller: { id: string; role: SystemRole }): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    req.user = {
      id: caller.id,
      username: "caller",
      role: caller.role,
      org: "default",
      orgRole: caller.role,
      workspace: null,
      workspaceRole: caller.role === "admin" ? "admin" : null,
    };
    next();
  });
  app.use("/api/dashboard", createUsageRoutes(makeUsageRepo(), makeWorkspaceRepo()));
  app.use(createErrorHandler(makeLogger(), false));
  return app;
}

describe("usage routes — GET /api/dashboard/usage", () => {
  it("returns org-wide provider and workspace totals for an admin caller", async () => {
    const res = await request(makeApp({ id: "a1", role: "admin" })).get(
      "/api/dashboard/usage",
    );
    expect(res.status).toBe(200);
    expect(res.body.byProvider).toHaveLength(2);
    expect(res.body.byWorkspace).toHaveLength(2);
    // Workspace rows decorated with slug/name.
    expect(res.body.byWorkspace).toContainEqual(
      expect.objectContaining({ workspaceId: "ws-1", slug: "alpha", name: "Alpha", totalTokens: 140 }),
    );
  });

  it("scopes both provider and workspace totals to a member's workspaces", async () => {
    const res = await request(makeApp({ id: "m1", role: "member" })).get(
      "/api/dashboard/usage",
    );
    expect(res.status).toBe(200);
    // Only ws-1 usage is visible — ws-2 (anthropic vs openai) must not leak.
    expect(res.body.byWorkspace.map((r: { workspaceId: string }) => r.workspaceId)).toEqual(["ws-1"]);
    expect(res.body.byProvider.map((r: { providerKind: string }) => r.providerKind)).toEqual(["anthropic"]);
  });

  it("returns empty totals for a member with no workspaces", async () => {
    const res = await request(makeApp({ id: "m9", role: "member" })).get(
      "/api/dashboard/usage",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ byProvider: [], byWorkspace: [] });
  });

  it("returns 401 without an Authorization header", async () => {
    const app = express();
    app.use(
      "/api/dashboard",
      createRequireAuth({} as AppContainer),
      createUsageRoutes(makeUsageRepo(), makeWorkspaceRepo()),
    );
    const res = await request(app).get("/api/dashboard/usage");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("missing_token");
  });
});
