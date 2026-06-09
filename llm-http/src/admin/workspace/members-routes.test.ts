import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { AuditEmitter, AuditEvent, WorkspaceRole } from "@ai-connect/shared";
import { createWsMembersRoutes } from "./members-routes.js";
import { createWsRolesRoutes } from "./roles-routes.js";
import {
  InMemoryWsMembersRepository,
  type WsMemberRow,
} from "./members-repo.js";
import { DefaultWsMembersService } from "./members-service.js";
import { createErrorHandler } from "../../shared/error-handler.js";
import { createRequireWorkspaceAdmin } from "../../auth/auth-middleware.js";
import type { AppContainer } from "../../container.js";
import type { Logger } from "../../logger.js";

const WS_ID = "demo-ws";
const ORG_ID = "demo-org";

interface TestHarness {
  app: express.Express;
  emitted: AuditEvent[];
  repo: InMemoryWsMembersRepository;
}

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

function makeHarness(opts?: {
  seed?: WsMemberRow[];
  workspaceRole?: WorkspaceRole | null;
}): TestHarness {
  const workspaceRole: WorkspaceRole | null = opts?.workspaceRole ?? "admin";
  const seed = opts?.seed ?? [
    {
      id: "m-admin",
      email: "admin@demo.example",
      role: "admin" as WorkspaceRole,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m-member",
      email: "member@demo.example",
      role: "member" as WorkspaceRole,
      joinedAt: "2026-02-01T00:00:00.000Z",
    },
  ];

  const emitted: AuditEvent[] = [];
  const emitter: AuditEmitter = {
    emit: vi.fn(async (event: AuditEvent) => {
      emitted.push(event);
    }),
  };

  const repo = new InMemoryWsMembersRepository(new Map([[WS_ID, seed]]));
  const logger = makeLogger();
  const service = new DefaultWsMembersService(repo, emitter, logger);

  const container = { wsMembersService: service } as unknown as AppContainer;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "actor",
      username: "actor",
      role: "admin",
      org: ORG_ID,
      orgRole: "admin",
      workspace: workspaceRole === null ? null : WS_ID,
      workspaceRole,
    };
    next();
  });
  app.use(
    "/admin/workspace/members",
    createRequireWorkspaceAdmin(),
    createWsMembersRoutes(container),
  );
  app.use(
    "/admin/workspace/roles",
    createRequireWorkspaceAdmin(),
    createWsRolesRoutes(),
  );
  app.use(createErrorHandler(logger, false));

  return { app, emitted, repo };
}

describe("workspace members routes — auth", () => {
  it("returns 403 for member workspaceRole on GET", async () => {
    const h = makeHarness({ workspaceRole: "member" });
    const res = await request(h.app).get("/admin/workspace/members");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("role_required");
  });

  it("returns 403 for viewer on POST invite", async () => {
    const h = makeHarness({ workspaceRole: "viewer" });
    const res = await request(h.app)
      .post("/admin/workspace/members/invite")
      .send({ email: "x@demo.example", role: "member" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for member on PATCH role", async () => {
    const h = makeHarness({ workspaceRole: "member" });
    const res = await request(h.app)
      .patch("/admin/workspace/members/m-member")
      .send({ role: "viewer" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for viewer on DELETE", async () => {
    const h = makeHarness({ workspaceRole: "viewer" });
    const res = await request(h.app).delete(
      "/admin/workspace/members/m-member",
    );
    expect(res.status).toBe(403);
  });
});

describe("workspace members routes — GET /", () => {
  it("returns 200 with the list", async () => {
    const h = makeHarness();
    const res = await request(h.app).get("/admin/workspace/members");
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0]).toMatchObject({
      email: "admin@demo.example",
      role: "admin",
    });
  });
});

describe("workspace members routes — POST /invite", () => {
  it("returns 201 and emits member.invited", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/workspace/members/invite")
      .send({ email: "new@demo.example", role: "viewer" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "new@demo.example",
      role: "viewer",
    });

    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]?.action).toBe("member.invited");
  });

  it("returns 409 when a member with this email already exists", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/workspace/members/invite")
      .send({ email: "member@demo.example", role: "viewer" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("duplicate_member");
  });

  it("returns 400 for invalid email", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/workspace/members/invite")
      .send({ email: "nope", role: "member" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_body");
  });

  it("returns 400 for invalid role", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/workspace/members/invite")
      .send({ email: "x@demo.example", role: "superuser" });
    expect(res.status).toBe(400);
  });
});

describe("workspace members routes — PATCH /:id (BR-099)", () => {
  it("returns 200 when demoting one of two admins", async () => {
    const h = makeHarness({
      seed: [
        {
          id: "m-a1",
          email: "a1@demo.example",
          role: "admin",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "m-a2",
          email: "a2@demo.example",
          role: "admin",
          joinedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const res = await request(h.app)
      .patch("/admin/workspace/members/m-a1")
      .send({ role: "member" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("member");

    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted[0]).toMatchObject({
      action: "member.role_changed",
      before: { role: "admin" },
      after: { role: "member" },
    });
  });

  it("returns 422 last_admin when demoting the only admin", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .patch("/admin/workspace/members/m-admin")
      .send({ role: "member" });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: "unprocessable_entity",
      code: "last_admin",
    });
  });

  it("returns 404 when member does not exist", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .patch("/admin/workspace/members/missing")
      .send({ role: "member" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("member_not_found");
  });
});

describe("workspace members routes — DELETE /:id (BR-099)", () => {
  it("returns 200 when removing a non-admin", async () => {
    const h = makeHarness();
    const res = await request(h.app).delete(
      "/admin/workspace/members/m-member",
    );
    expect(res.status).toBe(200);

    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted[0]?.action).toBe("member.removed");
  });

  it("returns 200 when removing one of two admins", async () => {
    const h = makeHarness({
      seed: [
        {
          id: "m-a1",
          email: "a1@demo.example",
          role: "admin",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "m-a2",
          email: "a2@demo.example",
          role: "admin",
          joinedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const res = await request(h.app).delete("/admin/workspace/members/m-a1");
    expect(res.status).toBe(200);
  });

  it("returns 422 last_admin when removing the only admin", async () => {
    const h = makeHarness();
    const res = await request(h.app).delete(
      "/admin/workspace/members/m-admin",
    );
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: "unprocessable_entity",
      code: "last_admin",
    });
  });

  it("returns 404 when member does not exist", async () => {
    const h = makeHarness();
    const res = await request(h.app).delete(
      "/admin/workspace/members/missing",
    );
    expect(res.status).toBe(404);
  });
});

describe("workspace roles routes — GET /", () => {
  it("returns 200 with the 4-role catalogue", async () => {
    const h = makeHarness();
    const res = await request(h.app).get("/admin/workspace/roles");
    expect(res.status).toBe(200);
    expect(res.body.roles).toHaveLength(4);
    expect(res.body.roles.map((r: { role: string }) => r.role)).toEqual([
      "owner",
      "admin",
      "member",
      "viewer",
    ]);
    for (const r of res.body.roles as Array<{ description: string }>) {
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  it("returns 403 for non-admin workspace role", async () => {
    const h = makeHarness({ workspaceRole: "member" });
    const res = await request(h.app).get("/admin/workspace/roles");
    expect(res.status).toBe(403);
  });
});
