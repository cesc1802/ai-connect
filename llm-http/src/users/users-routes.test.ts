import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { SystemRole } from "@ai-connect/shared";
import { createUsersRoutes } from "./users-routes.js";
import type { BasicUser } from "./users-repo.js";
import { InMemoryUsersRepository } from "./__tests__/in-memory-users-repository.js";
import { DefaultUsersService } from "./users-service.js";
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

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
}

function makeApp(caller: { id: string; role: SystemRole }): express.Express {
  const repo = new InMemoryUsersRepository(SEED_USERS, MEMBERSHIPS);
  const service = new DefaultUsersService(repo);
  const container = { usersService: service } as unknown as AppContainer;

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
  app.use("/users", createUsersRoutes(container));
  app.use(createErrorHandler(makeLogger(), false));
  return app;
}

describe("users routes — GET /users", () => {
  it("returns every user for an admin caller", async () => {
    const res = await request(makeApp({ id: "a1", role: "admin" })).get(
      "/users",
    );
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(4);
    expect(res.body.users[0]).toMatchObject({
      id: "a1",
      username: "alice-admin",
      role: "admin",
    });
  });

  it("returns only co-workspace users (incl. self) for a member caller", async () => {
    const res = await request(makeApp({ id: "m1", role: "member" })).get(
      "/users",
    );
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: BasicUser) => u.id).sort();
    expect(ids).toEqual(["m1", "m2"]);
  });

  it("returns only self for a member with no workspace memberships", async () => {
    const res = await request(makeApp({ id: "a1", role: "member" })).get(
      "/users",
    );
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: BasicUser) => u.id);
    expect(ids).toEqual(["a1"]);
  });

  it("returns 401 without an Authorization header", async () => {
    // missing_token short-circuits before any container dependency is touched.
    const app = express();
    app.use(
      "/users",
      createRequireAuth({} as AppContainer),
      createUsersRoutes({} as AppContainer),
    );
    const res = await request(app).get("/users");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("missing_token");
  });
});
