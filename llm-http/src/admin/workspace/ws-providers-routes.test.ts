import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import type {
  AuditEmitter,
  AuditEvent,
  OrgRole,
  WorkspaceRole,
} from "@ai-connect/shared";
import { InMemoryProvidersRepository } from "../org/providers-repo.js";
import { InMemoryWsProviderBindingsRepo } from "./ws-providers-repo.js";
import {
  WsProvidersService,
  computeProvidersEtag,
} from "./ws-providers-service.js";
import { createWsProvidersRoutes } from "./ws-providers-routes.js";
import { createRequireWorkspaceAdmin } from "../../auth/auth-middleware.js";
import { ApiKeyVault } from "../org/api-key-vault.js";

const ORG = "org-1";
const WS = "ws-1";
const USER = "user-1";

function makeAuthStub(
  workspaceRole: WorkspaceRole | null,
  orgRole: OrgRole = "member",
): RequestHandler {
  return (req, _res, next) => {
    req.user = {
      id: USER,
      username: "alice",
      org: ORG,
      orgRole,
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
  } as unknown as Parameters<typeof WsProvidersService>[3];
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
  repo: InMemoryProvidersRepository,
  count: number,
): Promise<string[]> {
  const vault = new ApiKeyVault({ NODE_ENV: "test" });
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = await repo.create({
      orgId: ORG,
      displayName: `Provider ${i}`,
      providerKind: "openai",
      encryptedKey: vault.encrypt("sk-aaaaaa1234"),
      lastFour: "1234",
    });
    ids.push(r.id);
  }
  return ids;
}

function makeApp(opts: {
  workspaceRole: WorkspaceRole | null;
  audit: AuditEmitter;
}): {
  app: Express;
  pool: InMemoryProvidersRepository;
  bindings: InMemoryWsProviderBindingsRepo;
} {
  const pool = new InMemoryProvidersRepository();
  const bindings = new InMemoryWsProviderBindingsRepo();
  const service = new WsProvidersService(
    bindings,
    pool,
    opts.audit,
    silentLogger() as never,
  );
  const app = express();
  app.use(express.json());
  app.use(makeAuthStub(opts.workspaceRole));
  app.use(
    "/admin/workspace/providers",
    createRequireWorkspaceAdmin(),
    createWsProvidersRoutes(service),
  );
  return { app, pool, bindings };
}

describe("WS Providers Routes", () => {
  let audit: ReturnType<typeof makeAuditSpy>;

  beforeEach(() => {
    audit = makeAuditSpy();
  });

  describe("GET /", () => {
    it("returns 200 with empty pool yielding empty available + bound", async () => {
      const { app } = makeApp({ workspaceRole: "admin", audit: audit.emitter });
      const res = await request(app).get("/admin/workspace/providers");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: [], bound: [] });
      expect(res.headers.etag).toBe(computeProvidersEtag([]));
    });

    it("returns ETag matching sorted bound ids", async () => {
      const { app, pool, bindings } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 3);
      await bindings.set(ORG, WS, [ids[1]!, ids[0]!]);
      const res = await request(app).get("/admin/workspace/providers");
      expect(res.status).toBe(200);
      expect(res.body.bound).toHaveLength(2);
      expect(res.body.available).toHaveLength(1);
      expect(res.headers.etag).toBe(
        computeProvidersEtag([ids[0]!, ids[1]!]),
      );
    });

    it("returns 403 for member role", async () => {
      const { app } = makeApp({ workspaceRole: "member", audit: audit.emitter });
      const res = await request(app).get("/admin/workspace/providers");
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /", () => {
    it("returns 200 happy path and emits audit on change", async () => {
      const { app, pool } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 2);
      const initial = await request(app).get("/admin/workspace/providers");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/providers")
        .set("If-Match", etag)
        .send({ providerIds: [ids[0]!, ids[1]!] });
      expect(res.status).toBe(200);
      expect(res.body.bound.map((b: { id: string }) => b.id).sort()).toEqual(
        [...ids].sort(),
      );
      expect(audit.events).toHaveLength(1);
      expect(audit.events[0]!.action).toBe("workspace.providers_rebound");
    });

    it("is idempotent: equal payload returns 200 with NO audit emit", async () => {
      const { app, pool, bindings } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 2);
      await bindings.set(ORG, WS, [ids[0]!, ids[1]!]);
      const initial = await request(app).get("/admin/workspace/providers");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/providers")
        .set("If-Match", etag)
        .send({ providerIds: [ids[1]!, ids[0]!] });
      expect(res.status).toBe(200);
      expect(audit.events).toHaveLength(0);
    });

    it("returns 400 with invalidIds when id is not in org pool", async () => {
      const { app, pool } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 1);
      const initial = await request(app).get("/admin/workspace/providers");
      const etag = initial.headers.etag as string;
      const res = await request(app)
        .put("/admin/workspace/providers")
        .set("If-Match", etag)
        .send({ providerIds: [ids[0]!, "bogus-id"] });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("not_in_org_pool");
      expect(res.body.invalidIds).toEqual(["bogus-id"]);
      expect(audit.events).toHaveLength(0);
    });

    it("returns 409 on stale ETag", async () => {
      const { app, pool } = makeApp({
        workspaceRole: "admin",
        audit: audit.emitter,
      });
      const ids = await seedPool(pool, 2);
      const res = await request(app)
        .put("/admin/workspace/providers")
        .set("If-Match", "deadbeefdeadbeef")
        .send({ providerIds: [ids[0]!] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("etag_mismatch");
      expect(audit.events).toHaveLength(0);
    });

    it("returns 403 for member role", async () => {
      const { app } = makeApp({
        workspaceRole: "member",
        audit: audit.emitter,
      });
      const res = await request(app)
        .put("/admin/workspace/providers")
        .send({ providerIds: [] });
      expect(res.status).toBe(403);
    });
  });

  describe("computeProvidersEtag", () => {
    it("is deterministic regardless of input order", () => {
      expect(computeProvidersEtag(["a", "b", "c"])).toBe(
        computeProvidersEtag(["c", "b", "a"]),
      );
    });

    it("differs when ids differ", () => {
      expect(computeProvidersEtag(["a", "b"])).not.toBe(
        computeProvidersEtag(["a", "b", "c"]),
      );
    });

    it("returns hex of length 16", () => {
      expect(computeProvidersEtag(["x"])).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
