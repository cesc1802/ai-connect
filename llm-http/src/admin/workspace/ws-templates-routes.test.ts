import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import type {
  AuditEmitter,
  AuditEvent,
  WorkspaceRole,
} from "@ai-connect/shared";
import { InMemoryOrgTemplateRepo } from "../org/templates-repo.js";
import { InMemoryWsTemplateBindingsRepo } from "./ws-templates-repo.js";
import {
  WsTemplatesService,
  computeTemplatesEtag,
} from "./ws-templates-service.js";
import { createWsTemplatesRoutes } from "./ws-templates-routes.js";
import { createRequireWorkspaceAdmin } from "../../auth/auth-middleware.js";

const ORG = "org-1";
const WS = "ws-1";
const USER = "user-1";

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

function silentLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Parameters<typeof WsTemplatesService>[3];
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

async function seedPool(
  pool: InMemoryOrgTemplateRepo,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = await pool.create(ORG, {
      name: `Template ${i}`,
      body: `body ${i}`,
      tags: [],
    });
    ids.push(row.id);
  }
  return ids;
}

function makeApp(opts: {
  workspaceRole: WorkspaceRole | null;
  audit: AuditEmitter;
}): {
  app: Express;
  pool: InMemoryOrgTemplateRepo;
  bindings: InMemoryWsTemplateBindingsRepo;
} {
  const pool = new InMemoryOrgTemplateRepo();
  const bindings = new InMemoryWsTemplateBindingsRepo();
  const service = new WsTemplatesService(
    bindings,
    pool,
    opts.audit,
    silentLogger() as never,
  );
  const app = express();
  app.use(express.json());
  app.use(makeAuthStub(opts.workspaceRole));
  app.use(
    "/admin/workspace/templates",
    createRequireWorkspaceAdmin(),
    createWsTemplatesRoutes(service),
  );
  return { app, pool, bindings };
}

describe("WS Templates Routes", () => {
  let audit: ReturnType<typeof makeAuditSpy>;

  beforeEach(() => {
    audit = makeAuditSpy();
  });

  describe("GET /", () => {
    it("returns 200 with empty pool: empty available and bound", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app).get("/admin/workspace/templates");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: [], bound: [] });
      expect(res.headers.etag).toBe(computeTemplatesEtag([]));
    });

    it("returns ETag reflecting templateId + suggestedRole", async () => {
      const { app, pool, bindings } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 2);
      await bindings.set(ORG, WS, [
        { templateId: ids[0]!, suggestedRole: "member" },
      ]);
      const res = await request(app).get("/admin/workspace/templates");
      expect(res.status).toBe(200);
      expect(res.body.bound).toHaveLength(1);
      expect(res.body.bound[0].suggestedRole).toBe("member");
      expect(res.body.available).toHaveLength(1);
      expect(res.headers.etag).toBe(
        computeTemplatesEtag([
          { templateId: ids[0]!, suggestedRole: "member" },
        ]),
      );
    });

    it("returns 403 for member role", async () => {
      const { app } = makeApp({
        workspaceRole: "member",
        audit: audit.emitter,
      });
      const res = await request(app).get("/admin/workspace/templates");
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /", () => {
    it("returns 200 happy path with audit emit including roleChanged", async () => {
      const { app, pool, bindings } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 2);
      await bindings.set(ORG, WS, [
        { templateId: ids[0]!, suggestedRole: "member" },
      ]);
      const initial = await request(app).get("/admin/workspace/templates");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/templates")
        .set("If-Match", etag)
        .send({
          templates: [
            { templateId: ids[0]!, suggestedRole: "admin" },
            { templateId: ids[1]!, suggestedRole: "viewer" },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.bound).toHaveLength(2);
      expect(audit.events).toHaveLength(1);
      const evt = audit.events[0]!;
      expect(evt.action).toBe("workspace.templates_rebound");
      const after = evt.after as {
        diff: {
          added: string[];
          removed: string[];
          roleChanged: Array<{ templateId: string }>;
        };
      };
      expect(after.diff.added).toEqual([ids[1]!]);
      expect(after.diff.removed).toEqual([]);
      expect(after.diff.roleChanged).toHaveLength(1);
      expect(after.diff.roleChanged[0]!.templateId).toBe(ids[0]!);
    });

    it("is idempotent: same payload returns 200 with NO audit emit", async () => {
      const { app, pool, bindings } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 1);
      await bindings.set(ORG, WS, [
        { templateId: ids[0]!, suggestedRole: "member" },
      ]);
      const initial = await request(app).get("/admin/workspace/templates");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/templates")
        .set("If-Match", etag)
        .send({
          templates: [{ templateId: ids[0]!, suggestedRole: "member" }],
        });
      expect(res.status).toBe(200);
      expect(audit.events).toHaveLength(0);
    });

    it("returns 400 with invalidIds when id is not in org pool", async () => {
      const { app, pool } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 1);
      const initial = await request(app).get("/admin/workspace/templates");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/templates")
        .set("If-Match", etag)
        .send({
          templates: [
            { templateId: ids[0]!, suggestedRole: "member" },
            { templateId: "bogus-id", suggestedRole: "member" },
          ],
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("not_in_org_pool");
      expect(res.body.invalidIds).toEqual(["bogus-id"]);
    });

    it("returns 409 on stale ETag", async () => {
      const { app, pool } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 1);
      const res = await request(app)
        .put("/admin/workspace/templates")
        .set("If-Match", "deadbeefdeadbeef")
        .send({
          templates: [{ templateId: ids[0]!, suggestedRole: "member" }],
        });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("etag_mismatch");
    });

    it("returns 403 for member role", async () => {
      const { app } = makeApp({
        workspaceRole: "member",
        audit: audit.emitter,
      });
      const res = await request(app)
        .put("/admin/workspace/templates")
        .send({ templates: [] });
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid suggestedRole value", async () => {
      const { app, pool } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 1);
      const initial = await request(app).get("/admin/workspace/templates");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/templates")
        .set("If-Match", etag)
        .send({
          templates: [{ templateId: ids[0]!, suggestedRole: "boss" }],
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_body");
    });
  });

  describe("computeTemplatesEtag", () => {
    it("changes when role changes for same templateId", () => {
      const a = computeTemplatesEtag([
        { templateId: "t1", suggestedRole: "member" },
      ]);
      const b = computeTemplatesEtag([
        { templateId: "t1", suggestedRole: "admin" },
      ]);
      expect(a).not.toBe(b);
    });

    it("is order-independent", () => {
      const a = computeTemplatesEtag([
        { templateId: "t1", suggestedRole: "member" },
        { templateId: "t2", suggestedRole: "viewer" },
      ]);
      const b = computeTemplatesEtag([
        { templateId: "t2", suggestedRole: "viewer" },
        { templateId: "t1", suggestedRole: "member" },
      ]);
      expect(a).toBe(b);
    });
  });
});
