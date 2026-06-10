import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createWorkspaceProvidersRoutes } from "../workspace-providers-routes.js";
import type { WorkspaceProvidersRepository } from "../workspace-providers-repository.js";
import type { WorkspaceRepository } from "../workspace-repository.js";

const ADMIN_USER = { id: "00000000-0000-0000-0000-000000000001", username: "admin", role: "admin" } as Request["user"];
const MEMBER_USER = { id: "00000000-0000-0000-0000-000000000002", username: "mem", role: "member" } as Request["user"];

const WS_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PROVIDER_ID = "cccccccc-0000-0000-0000-000000000001";

const WS_SUMMARY = { id: WS_ID, slug: "alpha", name: "Alpha", createdAt: new Date() };
const PROVIDER_ROW = { providerId: PROVIDER_ID, name: "OpenAI", keyLabel: "key1", icon: "sparkles", enabled: true };

describe("Workspace Providers Routes", () => {
  let providersRepo: WorkspaceProvidersRepository;
  let workspaceRepo: WorkspaceRepository;

  beforeEach(() => {
    providersRepo = {
      listForWorkspace: vi.fn(),
      setEnabled: vi.fn(),
      providerExists: vi.fn(),
    };
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

  async function callRoute(
    method: "get" | "patch",
    routePath: string,
    req: Partial<Request>
  ) {
    const router = createWorkspaceProvidersRoutes(providersRepo, workspaceRepo);
    const mockRequest = { params: {}, query: {}, body: {}, ...req } as unknown as Request;
    const mockResponse = mockRes();
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const layer = stack.find(
      (l: any) => l.route?.path === routePath && l.route?.methods?.[method]
    );
    if (!layer) throw new Error(`Route not found: ${method} ${routePath}`);
    const handler = (layer.route.stack || [])[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, next: mockNext };
  }

  // ── GET / ─────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("get", "/", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 404 for non-uuid workspace id", async () => {
      const { response } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: "bad" } as any });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(workspaceRepo.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when workspace not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(null);
      const { response } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns providers list for admin without membership check", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(providersRepo.listForWorkspace).mockResolvedValue([PROVIDER_ROW]);

      const { response } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ providers: [PROVIDER_ROW] });
      expect(workspaceRepo.isMember).not.toHaveBeenCalled();
    });

    it("returns 404 for member on foreign workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(false);

      const { response } = await callRoute("get", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns providers for member of own workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(true);
      vi.mocked(providersRepo.listForWorkspace).mockResolvedValue([PROVIDER_ROW]);

      const { response } = await callRoute("get", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ providers: [PROVIDER_ROW] });
    });

    it("forwards repo errors to next", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const boom = new Error("db down");
      vi.mocked(providersRepo.listForWorkspace).mockRejectedValue(boom);

      const { next } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── PATCH /:providerId ────────────────────────────────────────────────────

  describe("PATCH /:providerId", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("patch", "/:providerId", {
        user: undefined,
        params: { id: WS_ID, providerId: PROVIDER_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member", async () => {
      const { response } = await callRoute("patch", "/:providerId", {
        user: MEMBER_USER,
        params: { id: WS_ID, providerId: PROVIDER_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("returns 404 for non-uuid providerId", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callRoute("patch", "/:providerId", {
        user: ADMIN_USER,
        params: { id: WS_ID, providerId: "not-uuid" } as any,
        body: { enabled: true },
      });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns 400 for invalid body", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callRoute("patch", "/:providerId", {
        user: ADMIN_USER,
        params: { id: WS_ID, providerId: PROVIDER_ID } as any,
        body: { enabled: "yes" },
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when provider does not exist", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(providersRepo.setEnabled).mockResolvedValue(null);

      const { response } = await callRoute("patch", "/:providerId", {
        user: ADMIN_USER,
        params: { id: WS_ID, providerId: PROVIDER_ID } as any,
        body: { enabled: false },
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "provider_not_found" }));
    });

    it("toggles enabled and returns updated row", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(providersRepo.setEnabled).mockResolvedValue({ providerId: PROVIDER_ID, enabled: false });

      const { response } = await callRoute("patch", "/:providerId", {
        user: ADMIN_USER,
        params: { id: WS_ID, providerId: PROVIDER_ID } as any,
        body: { enabled: false },
      });
      expect(providersRepo.setEnabled).toHaveBeenCalledWith(WS_ID, PROVIDER_ID, false);
      expect(response.json).toHaveBeenCalledWith({ providerId: PROVIDER_ID, enabled: false });
    });

    it("forwards repo errors to next", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const boom = new Error("db down");
      vi.mocked(providersRepo.setEnabled).mockRejectedValue(boom);

      const { next } = await callRoute("patch", "/:providerId", {
        user: ADMIN_USER,
        params: { id: WS_ID, providerId: PROVIDER_ID } as any,
        body: { enabled: true },
      });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
