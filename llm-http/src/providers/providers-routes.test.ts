import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction, Router } from "express";
import type { AuditEmitter } from "@ai-connect/shared";
import { ApiKeyVault } from "./api-key-vault.js";
import { InMemoryProvidersRepository } from "./__tests__/in-memory-providers-repository.js";
import {
  OrgProvidersService,
  ProviderInUseError,
} from "./providers-service.js";
import { createRequireOrgAdmin } from "../auth/auth-middleware.js";
import type { CheckResult, CheckTarget } from "./connection-checker.js";
import { createProvidersRoutes } from "./providers-routes.js";

const TEST_ORG = "org-test";
const TEST_USER = "user-1";
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

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
  user: { id: string; org: string; orgRole?: "admin" | "member" } | null = {
    id: TEST_USER,
    org: TEST_ORG,
    orgRole: "admin",
  },
): Request {
  return { body, params, user: user ?? undefined } as unknown as Request;
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
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      const handler = layer.route.stack[0]?.handle;
      if (!handler) throw new Error(`No handler for ${method} ${path}`);
      return handler;
    }
  }
  throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
}

function jsonPayload<T>(res: MockRes): T {
  return res.json.mock.calls[0]?.[0] as T;
}

describe("Providers Routes (/providers)", () => {
  let repo: InMemoryProvidersRepository;
  let vault: ApiKeyVault;
  let auditEmitter: AuditEmitter;
  let service: OrgProvidersService;
  let checker: ReturnType<typeof vi.fn>;
  let router: Router;

  const actor = { userId: TEST_USER, orgId: TEST_ORG };

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
    };
    service = new OrgProvidersService(repo, vault, auditEmitter, logger as never);
    checker = vi.fn(async (_target: CheckTarget): Promise<CheckResult> => ({
      ok: true,
      latencyMs: 12,
    }));
    router = createProvidersRoutes({ service, repo, vault, checker });
  });

  describe("GET / (list)", () => {
    it("returns 200 with providers; no key material in payload", async () => {
      await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-very-secret-1234",
      });

      const res = makeRes();
      await getHandler(router, "get", "/")(makeReq({}), res, vi.fn());

      const payload = jsonPayload<{ providers: Array<Record<string, unknown>> }>(res);
      expect(payload.providers).toHaveLength(1);
      expect(JSON.stringify(payload)).not.toContain("sk-very-secret");
      expect(payload.providers[0]).not.toHaveProperty("encryptedKey");
      expect(payload.providers[0]?.lastFour).toBe("1234");
    });

    it("returns 401 without an authenticated user", async () => {
      const res = makeRes();
      await getHandler(router, "get", "/")(makeReq({}, {}, null), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("GET /catalog", () => {
    it("returns 200 with the catalog rows", async () => {
      repo.catalog.push(
        { name: "openai", host: "https://api.openai.com", models: ["gpt-4o"] },
        { name: "custom", host: "", models: [] },
      );

      const res = makeRes();
      await getHandler(router, "get", "/catalog")(makeReq({}), res, vi.fn());

      const payload = jsonPayload<{ catalog: Array<Record<string, unknown>> }>(res);
      expect(payload.catalog).toHaveLength(2);
      expect(payload.catalog[0]).toEqual({
        name: "openai",
        host: "https://api.openai.com",
        models: ["gpt-4o"],
      });
    });
  });

  describe("POST / (create)", () => {
    it("returns 201 with defaultModel and scope persisted", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/")(
        makeReq({
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-create-secret-9999",
          defaultModel: "gpt-4o-mini",
          scope: "select",
        }),
        res,
        vi.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(201);
      const payload = jsonPayload<{ provider: Record<string, unknown> }>(res);
      expect(payload.provider).toMatchObject({
        displayName: "OpenAI",
        providerKind: "openai",
        defaultModel: "gpt-4o-mini",
        scope: "select",
        lastFour: "9999",
      });
      expect(JSON.stringify(payload)).not.toContain("sk-create-secret");
    });

    it("defaults scope to 'org' and defaultModel to null when omitted", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/")(
        makeReq({
          displayName: "Anthropic",
          providerKind: "anthropic",
          apiKey: "sk-ant-secret-4321",
        }),
        res,
        vi.fn(),
      );

      const payload = jsonPayload<{ provider: Record<string, unknown> }>(res);
      expect(payload.provider.scope).toBe("org");
      expect(payload.provider.defaultModel).toBeNull();
    });

    it("returns 409 on duplicate displayName", async () => {
      await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-first-key-1111",
      });
      const res = makeRes();
      await getHandler(router, "post", "/")(
        makeReq({
          displayName: "OpenAI",
          providerKind: "openai",
          apiKey: "sk-second-key-2222",
        }),
        res,
        vi.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(jsonPayload<{ code: string }>(res).code).toBe("provider_duplicate_name");
    });

    it("returns 400 when ollama is missing baseUrl", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/")(
        makeReq({ displayName: "Local Ollama", providerKind: "ollama" }),
        res,
        vi.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonPayload<{ code: string }>(res).code).toBe("invalid_body");
    });

    it("returns 400 when a keyed kind is missing apiKey", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/")(
        makeReq({ displayName: "MiniMax", providerKind: "minimax" }),
        res,
        vi.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("PATCH /:id", () => {
    it("updates defaultModel and scope", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-key-1234",
      });

      const res = makeRes();
      await getHandler(router, "patch", "/:id")(
        makeReq({ defaultModel: "gpt-5", scope: "select" }, { id: created.id }),
        res,
        vi.fn(),
      );

      const payload = jsonPayload<{ provider: Record<string, unknown> }>(res);
      expect(payload.provider.defaultModel).toBe("gpt-5");
      expect(payload.provider.scope).toBe("select");
    });

    it("updates isEnabled", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-key-1234",
      });

      const res = makeRes();
      await getHandler(router, "patch", "/:id")(
        makeReq({ isEnabled: false }, { id: created.id }),
        res,
        vi.fn(),
      );

      expect(jsonPayload<{ provider: Record<string, unknown> }>(res).provider.isEnabled).toBe(false);
    });

    it("returns 404 for unknown provider", async () => {
      const res = makeRes();
      await getHandler(router, "patch", "/:id")(
        makeReq({ isEnabled: false }, { id: MISSING_UUID }),
        res,
        vi.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns 400 when no updatable field is supplied", async () => {
      const res = makeRes();
      await getHandler(router, "patch", "/:id")(makeReq({}, { id: MISSING_UUID }), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST /:id/rotate-key", () => {
    it("returns 200 with new lastFour; key never echoed", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-original-aaaa",
      });

      const res = makeRes();
      await getHandler(router, "post", "/:id/rotate-key")(
        makeReq({ apiKey: "sk-rotated-bbbb" }, { id: created.id }),
        res,
        vi.fn(),
      );

      const payload = jsonPayload<{ provider: Record<string, unknown> }>(res);
      expect(payload.provider.lastFour).toBe("bbbb");
      expect(JSON.stringify(payload)).not.toContain("sk-rotated");
    });
  });

  describe("DELETE /:id", () => {
    it("returns 204 on success", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-delete-9999",
      });

      const res = makeRes();
      await getHandler(router, "delete", "/:id")(
        makeReq(undefined, { id: created.id }),
        res,
        vi.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("returns 409 when the provider is in use", async () => {
      vi.spyOn(service, "delete").mockRejectedValueOnce(new ProviderInUseError("prov-1"));
      const res = makeRes();
      await getHandler(router, "delete", "/:id")(
        makeReq(undefined, { id: "prov-1" }),
        res,
        vi.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(jsonPayload<{ code: string }>(res).code).toBe("provider_in_use");
    });
  });

  describe("POST /check", () => {
    it("checks an ad-hoc target and returns the checker result", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({
          providerKind: "openai",
          apiKey: "sk-adhoc-secret-7777",
          baseUrl: "https://proxy.example.com",
        }),
        res,
        vi.fn(),
      );

      expect(checker).toHaveBeenCalledWith({
        providerKind: "openai",
        apiKey: "sk-adhoc-secret-7777",
        baseUrl: "https://proxy.example.com",
      });
      expect(jsonPayload<CheckResult>(res)).toEqual({ ok: true, latencyMs: 12 });
    });

    it("checks a stored provider by id, decrypting its key in-memory", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-stored-secret-3333",
      });

      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({ providerId: created.id }),
        res,
        vi.fn(),
      );

      const target = checker.mock.calls[0]?.[0] as CheckTarget;
      expect(target.providerKind).toBe("openai");
      expect(target.apiKey).toBe("sk-stored-secret-3333");
      expect(jsonPayload<CheckResult>(res)).toEqual({ ok: true, latencyMs: 12 });
    });

    it("ignores a baseUrl override when the stored key is used", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-stored-secret-3333",
        baseUrl: "https://api.openai.com",
      });

      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({ providerId: created.id, baseUrl: "https://evil.example.com" }),
        res,
        vi.fn(),
      );

      const target = checker.mock.calls[0]?.[0] as CheckTarget;
      expect(target.apiKey).toBe("sk-stored-secret-3333");
      expect(target.baseUrl).toBe("https://api.openai.com");
    });

    it("honors a baseUrl override when the caller supplies their own key", async () => {
      const created = await service.add(actor, {
        displayName: "OpenAI",
        providerKind: "openai",
        apiKey: "sk-stored-secret-3333",
      });

      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({
          providerId: created.id,
          apiKey: "sk-caller-own-key-9999",
          baseUrl: "https://staging.example.com",
        }),
        res,
        vi.fn(),
      );

      const target = checker.mock.calls[0]?.[0] as CheckTarget;
      expect(target.apiKey).toBe("sk-caller-own-key-9999");
      expect(target.baseUrl).toBe("https://staging.example.com");
    });

    it("returns 404 for an unknown providerId", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({ providerId: MISSING_UUID }),
        res,
        vi.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(checker).not.toHaveBeenCalled();
    });

    it("returns 400 when neither providerId nor providerKind is given", async () => {
      const res = makeRes();
      await getHandler(router, "post", "/check")(makeReq({}), res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns ok:false when the stored key fails to decrypt", async () => {
      const created = await repo.create({
        orgId: TEST_ORG,
        displayName: "Corrupted",
        providerKind: "openai",
        encryptedKey: "not-valid-ciphertext",
        lastFour: "0000",
      });

      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({ providerId: created.id }),
        res,
        vi.fn(),
      );

      expect(jsonPayload<CheckResult>(res)).toEqual({
        ok: false,
        reason: "Stored API key failed to decrypt",
      });
      expect(checker).not.toHaveBeenCalled();
    });

    it("propagates a failing check result without leaking the key", async () => {
      checker.mockResolvedValueOnce({
        ok: false,
        reason: "Authentication failed (HTTP 401) — check the API key",
      });
      const res = makeRes();
      await getHandler(router, "post", "/check")(
        makeReq({ providerKind: "openai", apiKey: "sk-bad-key-8888" }),
        res,
        vi.fn(),
      );

      const payload = jsonPayload<CheckResult>(res);
      expect(payload.ok).toBe(false);
      expect(JSON.stringify(payload)).not.toContain("sk-bad-key");
    });
  });

  describe("requireOrgAdmin → 403 for member-role", () => {
    it("blocks members with 403", () => {
      const middleware = createRequireOrgAdmin();
      const req = makeReq({}, {}, { id: TEST_USER, org: TEST_ORG, orgRole: "member" });
      const res = makeRes();
      const next = vi.fn();
      middleware(req, res as unknown as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
