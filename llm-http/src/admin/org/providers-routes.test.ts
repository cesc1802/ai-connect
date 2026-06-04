import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction, Router } from "express";
import type { AuditEmitter } from "@ai-connect/shared";
import { ApiKeyVault } from "./api-key-vault.js";
import { InMemoryProvidersRepository } from "./providers-repo.js";
import { OrgProvidersService } from "./providers-service.js";
import { createOrgProvidersRoutes } from "./providers-routes.js";
import { createRequireOrgAdmin } from "../../auth/auth-middleware.js";

const TEST_ORG = "org-test";
const TEST_USER = "user-1";

interface MockRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function makeRes(): MockRes & Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as MockRes & Response;
}

function makeReq(
  body: unknown,
  params: Record<string, string> = {},
  user: { id: string; org: string; orgRole?: "admin" | "member" } = {
    id: TEST_USER,
    org: TEST_ORG,
    orgRole: "admin",
  },
): Request {
  return { body, params, user } as unknown as Request;
}

interface RouteHandler {
  (req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

function getHandler(router: Router, method: string, path: string): RouteHandler {
  const stack = (router as unknown as { stack: Array<{ route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: RouteHandler }>;
  } }> }).stack;
  for (const layer of stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    ) {
      const handler = layer.route.stack[0]?.handle;
      if (!handler) throw new Error(`No handler for ${method} ${path}`);
      return handler;
    }
  }
  throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
}

describe("Org Providers Routes", () => {
  let repo: InMemoryProvidersRepository;
  let vault: ApiKeyVault;
  let auditEmitter: AuditEmitter;
  let service: OrgProvidersService;
  let router: Router;

  beforeEach(() => {
    repo = new InMemoryProvidersRepository();
    vault = new ApiKeyVault({ NODE_ENV: "test" });
    auditEmitter = { emit: vi.fn().mockResolvedValue(undefined) };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    } as unknown as Parameters<typeof OrgProvidersService>[3] extends infer L ? L : never;
    service = new OrgProvidersService(repo, vault, auditEmitter, logger as never);
    router = createOrgProvidersRoutes(service);
  });

  describe("GET / (list)", () => {
    it("returns 200 with providers array; no apiKey in any row", async () => {
      await service.add(
        { userId: TEST_USER, orgId: TEST_ORG },
        {
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-very-secret-1234",
        },
      );

      const req = makeReq({});
      const res = makeRes();
      await getHandler(router, "get", "/")(req, res, vi.fn());

      const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        providers: Array<Record<string, unknown>>;
      };
      expect(payload.providers).toHaveLength(1);
      expect(JSON.stringify(payload)).not.toContain("sk-very-secret");
      expect(JSON.stringify(payload)).not.toContain("apiKey");
      for (const p of payload.providers) {
        expect(p).not.toHaveProperty("apiKey");
        expect(p).not.toHaveProperty("encryptedKey");
        expect(p.lastFour).toBe("1234");
      }
    });
  });

  describe("POST / (add)", () => {
    it("returns 201 with provider; response has no apiKey", async () => {
      const req = makeReq({
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-create-secret-9999",
      });
      const res = makeRes();
      await getHandler(router, "post", "/")(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        provider: Record<string, unknown>;
      };
      expect(payload.provider).toMatchObject({
        displayName: "OpenAI",
        providerKind: "openai",
        isEnabled: true,
        hasKey: true,
        lastFour: "9999",
      });
      expect(payload.provider).not.toHaveProperty("apiKey");
      expect(JSON.stringify(payload)).not.toContain("sk-create-secret");
    });

    it("returns 409 on duplicate displayName", async () => {
      await service.add(
        { userId: TEST_USER, orgId: TEST_ORG },
        {
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-first-key-1111",
        },
      );
      const req = makeReq({
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-second-key-2222",
      });
      const res = makeRes();
      await getHandler(router, "post", "/")(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        code: string;
      };
      expect(payload.code).toBe("provider_duplicate_name");
    });

    it("returns 400 on invalid body", async () => {
      const req = makeReq({ displayName: "", providerKind: "openai", apiKey: "x" });
      const res = makeRes();
      await getHandler(router, "post", "/")(req, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("PATCH /:id (update isEnabled / displayName)", () => {
    it("returns 200 with updated isEnabled", async () => {
      const created = await service.add(
        { userId: TEST_USER, orgId: TEST_ORG },
        {
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-key-1234",
        },
      );

      const req = makeReq({ isEnabled: false }, { id: created.id });
      const res = makeRes();
      await getHandler(router, "patch", "/:id")(req, res, vi.fn());

      const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        provider: Record<string, unknown>;
      };
      expect(payload.provider.isEnabled).toBe(false);
      expect(payload.provider).not.toHaveProperty("apiKey");
    });

    it("returns 404 for unknown provider", async () => {
      const req = makeReq({ isEnabled: false }, { id: "missing" });
      const res = makeRes();
      await getHandler(router, "patch", "/:id")(req, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("POST /:id/rotate-key", () => {
    it("returns 200 with new lastFour, no apiKey in payload", async () => {
      const created = await service.add(
        { userId: TEST_USER, orgId: TEST_ORG },
        {
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-original-aaaa",
        },
      );

      const req = makeReq(
        { apiKey: "sk-rotated-bbbb" },
        { id: created.id },
      );
      const res = makeRes();
      await getHandler(router, "post", "/:id/rotate-key")(req, res, vi.fn());

      const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
        provider: Record<string, unknown>;
      };
      expect(payload.provider.lastFour).toBe("bbbb");
      expect(payload.provider).not.toHaveProperty("apiKey");
      expect(JSON.stringify(payload)).not.toContain("sk-rotated");
    });

    it("emits a provider.key_rotated audit event", async () => {
      const created = await service.add(
        { userId: TEST_USER, orgId: TEST_ORG },
        {
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-original-aaaa",
        },
      );
      vi.mocked(auditEmitter.emit).mockClear();

      const req = makeReq(
        { apiKey: "sk-rotated-bbbb" },
        { id: created.id },
      );
      const res = makeRes();
      await getHandler(router, "post", "/:id/rotate-key")(req, res, vi.fn());

      const events = vi
        .mocked(auditEmitter.emit)
        .mock.calls.map((c) => c[0]);
      expect(events.some((e) => e.action === "provider.key_rotated")).toBe(true);
      // The audit payload must NEVER contain the raw apiKey value.
      expect(JSON.stringify(events)).not.toContain("sk-rotated");
      expect(JSON.stringify(events)).not.toContain("apiKey");
    });
  });

  describe("DELETE /:id", () => {
    it("returns 204 on success", async () => {
      const created = await service.add(
        { userId: TEST_USER, orgId: TEST_ORG },
        {
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-delete-9999",
        },
      );

      const req = makeReq(undefined, { id: created.id });
      const res = makeRes();
      await getHandler(router, "delete", "/:id")(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe("requireOrgAdmin → 403 for member-role", () => {
    it("blocks members with 403", () => {
      const middleware = createRequireOrgAdmin();
      const req = {
        user: { id: TEST_USER, org: TEST_ORG, orgRole: "member" },
      } as unknown as Request;
      const res = makeRes();
      const next = vi.fn();
      middleware(req, res as unknown as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("audit isolation — audit emitter failure does not abort the write", () => {
    it("returns 201 even when emitter rejects", async () => {
      vi.mocked(auditEmitter.emit).mockRejectedValueOnce(new Error("emitter offline"));
      const req = makeReq({
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-resilient-1234",
      });
      const res = makeRes();
      await getHandler(router, "post", "/")(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      // wait for the swallowed rejection to settle
      await new Promise((r) => setImmediate(r));
    });
  });
});
