import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { SystemRole } from "@ai-connect/shared";
import { createDashboardRoutes } from "./dashboard-routes.js";
import { DefaultUsersService } from "../users/users-service.js";
import { InMemoryUsersRepository } from "../users/__tests__/in-memory-users-repository.js";
import type { BasicUser } from "../users/users-repo.js";
import type {
  WorkspaceRepository,
  WorkspaceSummary,
} from "../workspace/workspace-repository.js";
import type {
  ProvidersRepository,
  StoredProvider,
} from "../providers/providers-repository.js";
import { createRequireAuth } from "../auth/auth-middleware.js";
import { createErrorHandler } from "../shared/error-handler.js";
import type { AppContainer } from "../container.js";
import type { Logger } from "../logger.js";

const SEED_USERS: BasicUser[] = [
  { id: "a1", username: "alice-admin", role: "admin" },
  { id: "m1", username: "minh", role: "member" },
  { id: "m2", username: "ngoc", role: "member" },
  { id: "m3", username: "tuan", role: "member" },
];

// m1+m2 share ws-1; m3 isolated in ws-2; a1 has no memberships.
const MEMBERSHIPS = new Map<string, string[]>([
  ["m1", ["ws-1"]],
  ["m2", ["ws-1"]],
  ["m3", ["ws-2"]],
]);

const ALL_WORKSPACES: WorkspaceSummary[] = [
  { id: "ws-1", slug: "alpha", name: "Alpha", createdAt: new Date() },
  { id: "ws-2", slug: "beta", name: "Beta", createdAt: new Date() },
];

// Which workspaces each user belongs to (drives listForUser).
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

// Two enabled, one disabled — activeProviderCount must be 2 regardless of role.
const PROVIDERS = [
  { isEnabled: true },
  { isEnabled: false },
  { isEnabled: true },
] as unknown as StoredProvider[];

function makeProvidersRepo(): ProvidersRepository {
  return {
    listByOrg: async () => PROVIDERS,
  } as unknown as ProvidersRepository;
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
  const usersService = new DefaultUsersService(
    new InMemoryUsersRepository(SEED_USERS, MEMBERSHIPS),
  );

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
  app.use(
    "/api/dashboard",
    createDashboardRoutes(makeWorkspaceRepo(), usersService, makeProvidersRepo()),
  );
  app.use(createErrorHandler(makeLogger(), false));
  return app;
}

describe("dashboard routes — GET /api/dashboard/stats", () => {
  it("returns org-wide workspaces and member total for an admin caller", async () => {
    const res = await request(makeApp({ id: "a1", role: "admin" })).get(
      "/api/dashboard/stats",
    );
    expect(res.status).toBe(200);
    expect(res.body.workspaces).toHaveLength(2);
    expect(res.body.workspaces[0]).toEqual({
      id: "ws-1",
      slug: "alpha",
      name: "Alpha",
    });
    expect(res.body.memberCount).toBe(4);
    expect(res.body.activeProviderCount).toBe(2);
  });

  it("scopes workspaces and member count to a member caller", async () => {
    const res = await request(makeApp({ id: "m1", role: "member" })).get(
      "/api/dashboard/stats",
    );
    expect(res.status).toBe(200);
    // Only ws-1 (the workspace m1 belongs to).
    expect(res.body.workspaces.map((w: { id: string }) => w.id)).toEqual(["ws-1"]);
    // m1 shares ws-1 with m2 → 2 co-workspace members (incl. self).
    expect(res.body.memberCount).toBe(2);
    // Provider count stays org-wide.
    expect(res.body.activeProviderCount).toBe(2);
  });

  it("returns 401 without an Authorization header", async () => {
    // missing_token short-circuits in requireAuth before any dependency is touched.
    const app = express();
    app.use(
      "/api/dashboard",
      createRequireAuth({} as AppContainer),
      createDashboardRoutes(
        makeWorkspaceRepo(),
        new DefaultUsersService(new InMemoryUsersRepository([], new Map())),
        makeProvidersRepo(),
      ),
    );
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("missing_token");
  });
});
