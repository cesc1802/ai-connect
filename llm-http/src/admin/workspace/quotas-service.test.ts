import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import type {
  AuditEmitter,
  AuditEvent,
  WorkspaceRole,
} from "@ai-connect/shared";
import { InMemoryWsQuotasRepo } from "./quotas-repo.js";
import {
  StubUsageCounter,
  WsQuotasService,
  type UsageCounter,
} from "./quotas-service.js";
import { createWsQuotasRoutes } from "./quotas-routes.js";
import { createRequireWorkspaceAdmin } from "../../auth/auth-middleware.js";

const ORG = "org-1";
const WS = "ws-1";
const USER = "user-1";

function silentLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Parameters<typeof WsQuotasService>[3];
}

function makeAuthStub(workspaceRole: WorkspaceRole | null): RequestHandler {
  return (req, _res, next) => {
    req.user = {
      id: USER,
      username: "alice",
      org: ORG,
      orgRole: "member",
      workspace: workspaceRole ? WS : null,
      workspaceRole,
    };
    next();
  };
}

function makeAuditSpy(): { emitter: AuditEmitter; events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  const emitter: AuditEmitter = {
    emit: vi.fn(async (e: AuditEvent) => {
      events.push(e);
    }),
  };
  return { emitter, events };
}

class FixedUsageCounter implements UsageCounter {
  constructor(private readonly map: Map<WorkspaceRole, number>) {}
  async current(
    _org: string,
    _ws: string,
    role: WorkspaceRole,
  ): Promise<number> {
    return this.map.get(role) ?? 0;
  }
}

function makeApp(opts: {
  workspaceRole: WorkspaceRole | null;
  audit: AuditEmitter;
  usage?: UsageCounter;
}): {
  app: Express;
  repo: InMemoryWsQuotasRepo;
} {
  const repo = new InMemoryWsQuotasRepo();
  const service = new WsQuotasService(
    repo,
    opts.usage ?? new StubUsageCounter(),
    opts.audit,
    silentLogger() as never,
  );
  const app = express();
  app.use(express.json());
  app.use(makeAuthStub(opts.workspaceRole));
  app.use(
    "/admin/workspace/quotas",
    createRequireWorkspaceAdmin(),
    createWsQuotasRoutes(service),
  );
  return { app, repo };
}

describe("WS Quotas Service + Routes", () => {
  let audit: ReturnType<typeof makeAuditSpy>;

  beforeEach(() => {
    audit = makeAuditSpy();
  });

  describe("GET /", () => {
    it("returns default seeded rows for all four roles", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app).get("/admin/workspace/quotas");
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(4);
      const roles = res.body.rows.map((r: { role: string }) => r.role).sort();
      expect(roles).toEqual(["admin", "member", "owner", "viewer"]);
      for (const row of res.body.rows) {
        expect(row.overCount).toBe(0);
      }
    });

    it("returns 403 for member role", async () => {
      const { app } = makeApp({
        workspaceRole: "member",
        audit: audit.emitter,
      });
      const res = await request(app).get("/admin/workspace/quotas");
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /", () => {
    it("happy path: no over-count returns 200 with no warnings and emits audit", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "member", maxRequests: 300 }] });
      expect(res.status).toBe(200);
      expect(res.body.warnings).toBeUndefined();
      const memberRow = res.body.rows.find(
        (r: { role: string }) => r.role === "member",
      );
      expect(memberRow.maxRequests).toBe(300);
      expect(audit.events).toHaveLength(1);
      const evt = audit.events[0]!;
      expect(evt.action).toBe("workspace.quotas_updated");
      const after = evt.after as { forced: boolean };
      expect(after.forced).toBe(false);
    });

    it("over-count without force returns warnings and does NOT persist", async () => {
      const usage = new FixedUsageCounter(new Map([["member", 250]]));
      const { app, repo } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
        usage,
      });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "member", maxRequests: 100 }] });
      expect(res.status).toBe(200);
      expect(res.body.warnings).toEqual([{ role: "member", overCount: 250 }]);
      const stored = await repo.get(ORG, WS);
      const memberRow = stored.find((r) => r.role === "member");
      expect(memberRow?.maxRequests).toBe(200); // seed unchanged
      expect(audit.events).toHaveLength(0);
    });

    it("over-count with force=true persists and audit records forced=true", async () => {
      const usage = new FixedUsageCounter(new Map([["member", 250]]));
      const { app, repo } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
        usage,
      });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "member", maxRequests: 100 }], force: true });
      expect(res.status).toBe(200);
      expect(res.body.warnings).toBeUndefined();
      const stored = await repo.get(ORG, WS);
      const memberRow = stored.find((r) => r.role === "member");
      expect(memberRow?.maxRequests).toBe(100);
      expect(audit.events).toHaveLength(1);
      const after = audit.events[0]!.after as { forced: boolean };
      expect(after.forced).toBe(true);
    });

    it("returns 403 for member role", async () => {
      const { app } = makeApp({
        workspaceRole: "member",
        audit: audit.emitter,
      });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "viewer", maxRequests: 1 }] });
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid role", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "boss", maxRequests: 1 }] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_body");
    });

    it("returns 400 for negative maxRequests", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "viewer", maxRequests: -1 }] });
      expect(res.status).toBe(400);
    });

    it("idempotent no-op: same value no audit emitted", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app)
        .patch("/admin/workspace/quotas")
        .send({ rows: [{ role: "member", maxRequests: 200 }] });
      expect(res.status).toBe(200);
      expect(audit.events).toHaveLength(0);
    });
  });
});
