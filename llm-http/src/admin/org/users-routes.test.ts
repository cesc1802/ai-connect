import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { AuditEmitter, AuditEvent } from "@ai-connect/shared";
import { createOrgUsersRoutes } from "./users-routes.js";
import {
  InMemoryOrgUsersRepository,
  type OrgUserRow,
} from "./users-repo.js";
import { DefaultOrgUsersService } from "./users-service.js";
import { createErrorHandler } from "../../shared/error-handler.js";
import type { AppContainer } from "../../container.js";
import type { Logger } from "../../logger.js";

interface TestHarness {
  app: express.Express;
  emitted: AuditEvent[];
  emitter: AuditEmitter;
  repo: InMemoryOrgUsersRepository;
  asAdmin: () => request.Test;
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
  seed?: Map<string, OrgUserRow[]>;
  user?: { id: string; org: string; orgRole: "admin" | "member" };
}): TestHarness {
  const user = opts?.user ?? {
    id: "actor-admin",
    org: "demo-org",
    orgRole: "admin" as const,
  };
  const seed =
    opts?.seed ??
    new Map<string, OrgUserRow[]>([
      [
        "demo-org",
        [
          {
            id: "u1",
            email: "ada@demo.example",
            status: "active",
            joinedAt: "2026-01-15T09:00:00.000Z",
          },
          {
            id: "u2",
            email: "grace@demo.example",
            status: "pending",
            joinedAt: "2026-02-08T14:30:00.000Z",
          },
        ],
      ],
    ]);

  const emitted: AuditEvent[] = [];
  const emitter: AuditEmitter = {
    emit: vi.fn(async (event: AuditEvent) => {
      emitted.push(event);
    }),
  };

  const repo = new InMemoryOrgUsersRepository(seed);
  const logger = makeLogger();
  const service = new DefaultOrgUsersService(repo, emitter, logger);

  const container = { orgUsersService: service } as unknown as AppContainer;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: user.id,
      username: "actor",
      org: user.org,
      orgRole: user.orgRole,
      workspace: null,
      workspaceRole: null,
    };
    if (user.orgRole !== "admin") {
      // emulate requireOrgAdmin: short-circuit 403
      _res.status(403).json({ code: "role_required", message: "Forbidden" });
      return;
    }
    next();
  });
  app.use("/admin/org/users", createOrgUsersRoutes(container));
  app.use(createErrorHandler(logger, false));

  return {
    app,
    emitted,
    emitter,
    repo,
    asAdmin: () => request(app) as unknown as request.Test,
  };
}

describe("org users routes — GET /admin/org/users", () => {
  it("returns 200 with the list for an org admin", async () => {
    const h = makeHarness();
    const res = await request(h.app).get("/admin/org/users");
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).toMatchObject({
      email: "ada@demo.example",
      status: "active",
    });
  });

  it("returns 403 when the caller is a member", async () => {
    const h = makeHarness({
      user: { id: "u-member", org: "demo-org", orgRole: "member" },
    });
    const res = await request(h.app).get("/admin/org/users");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("role_required");
  });
});

describe("org users routes — POST /admin/org/users/invite", () => {
  it("creates a pending row and returns 201 + audit emit", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/org/users/invite")
      .send({ email: "new@demo.example" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "new@demo.example",
      status: "pending",
    });
    expect(res.body.id).toBeTypeOf("string");

    // audit emit is fire-and-forget; flush microtasks
    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({
      action: "user.invited",
      actor: { userId: "actor-admin", orgId: "demo-org" },
      target: { kind: "user" },
    });
  });

  it("returns 409 when a pending invite already exists for that email", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/org/users/invite")
      .send({ email: "grace@demo.example" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("duplicate_pending");
  });

  it("returns 400 for an invalid email", async () => {
    const h = makeHarness();
    const res = await request(h.app)
      .post("/admin/org/users/invite")
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_body");
  });
});

describe("org users routes — POST /admin/org/users/:id/disable", () => {
  it("returns 200 with disabled row and emits audit", async () => {
    const h = makeHarness();
    const res = await request(h.app).post("/admin/org/users/u1/disable");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "u1", status: "disabled" });

    await new Promise<void>((r) => queueMicrotask(r));
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({
      action: "user.disabled",
      actor: { userId: "actor-admin", orgId: "demo-org" },
      target: { kind: "user", id: "u1" },
    });
  });

  it("returns 404 when the user does not exist", async () => {
    const h = makeHarness();
    const res = await request(h.app).post("/admin/org/users/does-not-exist/disable");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("user_not_found");
  });
});
