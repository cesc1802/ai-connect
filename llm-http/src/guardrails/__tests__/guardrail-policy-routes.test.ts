import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createGuardrailPolicyRoutes } from "../guardrail-policy-routes.js";
import type { GuardrailPolicyRepository } from "@ai-connect/shared";
import type { WorkspaceRepository } from "../../workspace/workspace-repository.js";

const ADMIN_USER = { id: "00000000-0000-0000-0000-000000000001", username: "admin", role: "admin" } as Request["user"];
const MEMBER_USER = { id: "00000000-0000-0000-0000-000000000002", username: "mem", role: "member" } as Request["user"];

const WS_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const WS_SUMMARY = { id: WS_ID, slug: "alpha", name: "Alpha", createdAt: new Date() };

const DISABLED_POLICY = { enabled: false, checks: [] };
const VALID_BODY = { enabled: true, checks: [{ kind: "pii", enabled: true, action: "redact" }] };

describe("Guardrail Policy Routes", () => {
  let policyRepo: GuardrailPolicyRepository;
  let workspaceRepo: WorkspaceRepository;

  beforeEach(() => {
    policyRepo = { get: vi.fn(), upsert: vi.fn() };
    workspaceRepo = {
      listAll: vi.fn(),
      listForUser: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
      isMember: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
  });

  function mockRes() {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    return res as Response;
  }

  async function callRoute(method: "get" | "put", req: Partial<Request>) {
    const router = createGuardrailPolicyRoutes(policyRepo, workspaceRepo);
    const mockRequest = { params: {}, query: {}, body: {}, ...req } as unknown as Request;
    const mockResponse = mockRes();
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const layer = stack.find((l: any) => l.route?.path === "/" && l.route?.methods?.[method]);
    if (!layer) throw new Error(`Route not found: ${method} /`);
    const handler = (layer.route.stack || [])[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, next: mockNext };
  }

  describe("GET /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("get", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 404 for non-uuid workspace id", async () => {
      const { response } = await callRoute("get", { user: ADMIN_USER, params: { id: "bad" } as any });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(workspaceRepo.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when workspace not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(null);
      const { response } = await callRoute("get", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns the policy for admin without membership check", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(policyRepo.get).mockResolvedValue(DISABLED_POLICY);

      const { response } = await callRoute("get", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith(DISABLED_POLICY);
      expect(workspaceRepo.isMember).not.toHaveBeenCalled();
    });

    it("returns 404 for member on foreign workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(false);

      const { response } = await callRoute("get", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(policyRepo.get).not.toHaveBeenCalled();
    });

    it("returns the policy for a member of their own workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(true);
      vi.mocked(policyRepo.get).mockResolvedValue(DISABLED_POLICY);

      const { response } = await callRoute("get", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith(DISABLED_POLICY);
    });
  });

  describe("PUT /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("put", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member", async () => {
      const { response } = await callRoute("put", {
        user: MEMBER_USER,
        params: { id: WS_ID } as any,
        body: VALID_BODY,
      });
      expect(response.status).toHaveBeenCalledWith(403);
      expect(policyRepo.upsert).not.toHaveBeenCalled();
    });

    it("returns 404 when workspace not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(null);
      const { response } = await callRoute("put", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: VALID_BODY,
      });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns 400 for invalid body", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callRoute("put", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { enabled: "yes" },
      });
      expect(response.status).toHaveBeenCalledWith(400);
      expect(policyRepo.upsert).not.toHaveBeenCalled();
    });

    it("upserts and returns the stored policy for admin", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(policyRepo.upsert).mockResolvedValue(undefined);
      vi.mocked(policyRepo.get).mockResolvedValue(VALID_BODY as any);

      const { response } = await callRoute("put", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: VALID_BODY,
      });
      expect(policyRepo.upsert).toHaveBeenCalledWith(WS_ID, expect.objectContaining({ enabled: true }));
      expect(response.json).toHaveBeenCalledWith(VALID_BODY);
    });

    it("forwards repo errors to next", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const boom = new Error("db down");
      vi.mocked(policyRepo.upsert).mockRejectedValue(boom);

      const { next } = await callRoute("put", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: VALID_BODY,
      });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
