import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type {
  WorkspaceMembership,
  WorkspaceMembersRepository,
} from "../workspace-members-repository.js";
import { createMeWorkspacesRoutes } from "../me-workspaces-routes.js";

function makeApp(
  memberships: WorkspaceMembership[],
  callerId?: string
): express.Express {
  const membersRepo = {
    listMembershipsForUser: vi.fn().mockResolvedValue(memberships),
  } as unknown as WorkspaceMembersRepository;

  const app = express();
  if (callerId) {
    app.use((req, _res, next) => {
      req.user = {
        id: callerId,
        username: "caller",
        role: "member",
        org: "default",
        orgRole: "member",
        workspace: null,
        workspaceRole: null,
      };
      next();
    });
  }
  app.use("/api/me/workspaces", createMeWorkspacesRoutes(membersRepo));
  return app;
}

describe("me workspaces routes — GET /api/me/workspaces", () => {
  it("returns the caller's memberships with roles", async () => {
    const res = await request(
      makeApp(
        [
          { workspaceId: "ws-1", slug: "core", name: "Core", roles: ["pm", "dev"] },
          { workspaceId: "ws-2", slug: "ops", name: "Ops", roles: [] },
        ],
        "u1"
      )
    ).get("/api/me/workspaces");

    expect(res.status).toBe(200);
    expect(res.body.workspaces).toEqual([
      { id: "ws-1", slug: "core", name: "Core", roles: ["pm", "dev"] },
      { id: "ws-2", slug: "ops", name: "Ops", roles: [] },
    ]);
  });

  it("returns an empty list when the caller has no memberships", async () => {
    const res = await request(makeApp([], "u1")).get("/api/me/workspaces");
    expect(res.status).toBe(200);
    expect(res.body.workspaces).toEqual([]);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(makeApp([])).get("/api/me/workspaces");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("missing_token");
  });
});
