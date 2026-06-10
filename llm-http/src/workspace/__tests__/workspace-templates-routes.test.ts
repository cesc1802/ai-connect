import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createWorkspaceTemplatesRoutes } from "../workspace-templates-routes.js";
import { createPromptTemplatesRoutes } from "../prompt-templates-routes.js";
import {
  TemplateAlreadyAttachedError,
  type WorkspaceTemplatesRepository,
} from "../workspace-templates-repository.js";
import type { WorkspaceRepository } from "../workspace-repository.js";

const ADMIN_USER = { id: "00000000-0000-0000-0000-000000000001", username: "admin", role: "admin" } as Request["user"];
const MEMBER_USER = { id: "00000000-0000-0000-0000-000000000002", username: "mem", role: "member" } as Request["user"];

const WS_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEMPLATE_ID = "dddddddd-0000-0000-0000-000000000001";

const WS_SUMMARY = { id: WS_ID, slug: "alpha", name: "Alpha", createdAt: new Date() };
const TEMPLATE_ROW = {
  id: TEMPLATE_ID, slug: "t1", title: "Review PR", category: "Kỹ thuật",
  icon: "code", authorName: "Thược", uses: 1240, description: "desc", body: null,
};

describe("Workspace Templates Routes", () => {
  let templatesRepo: WorkspaceTemplatesRepository;
  let workspaceRepo: WorkspaceRepository;

  beforeEach(() => {
    templatesRepo = {
      listLibrary: vi.fn(),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      listForWorkspace: vi.fn(),
      attach: vi.fn(),
      detach: vi.fn(),
      templateExists: vi.fn(),
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

  async function callWsRoute(
    method: "get" | "post" | "delete",
    routePath: string,
    req: Partial<Request>
  ) {
    const router = createWorkspaceTemplatesRoutes(templatesRepo, workspaceRepo);
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

  async function callLibraryRoute(req: Partial<Request>) {
    const router = createPromptTemplatesRoutes(templatesRepo);
    const mockRequest = { params: {}, query: {}, body: {}, ...req } as unknown as Request;
    const mockResponse = mockRes();
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const layer = stack.find((l: any) => l.route?.path === "/" && l.route?.methods?.["get"]);
    if (!layer) throw new Error("Route not found: GET /");
    const handler = (layer.route.stack || [])[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, next: mockNext };
  }

  // ── GET /prompt-templates ─────────────────────────────────────────────────

  describe("GET /prompt-templates (library)", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callLibraryRoute({ user: undefined });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns full library for any authenticated user", async () => {
      vi.mocked(templatesRepo.listLibrary).mockResolvedValue([TEMPLATE_ROW]);
      const { response } = await callLibraryRoute({ user: MEMBER_USER });
      expect(response.json).toHaveBeenCalledWith({ templates: [TEMPLATE_ROW] });
    });

    it("forwards repo errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(templatesRepo.listLibrary).mockRejectedValue(boom);
      const { next } = await callLibraryRoute({ user: ADMIN_USER });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── GET /workspaces/:id/templates ─────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callWsRoute("get", "/", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 404 for non-uuid workspace id", async () => {
      const { response } = await callWsRoute("get", "/", { user: ADMIN_USER, params: { id: "bad" } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns 404 when workspace not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(null);
      const { response } = await callWsRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns attached templates for admin", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(templatesRepo.listForWorkspace).mockResolvedValue([TEMPLATE_ROW]);

      const { response } = await callWsRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ templates: [TEMPLATE_ROW] });
      expect(workspaceRepo.isMember).not.toHaveBeenCalled();
    });

    it("returns 404 for member on foreign workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(false);
      const { response } = await callWsRoute("get", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns templates for member of own workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(true);
      vi.mocked(templatesRepo.listForWorkspace).mockResolvedValue([]);
      const { response } = await callWsRoute("get", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ templates: [] });
    });
  });

  // ── POST / ────────────────────────────────────────────────────────────────

  describe("POST /", () => {
    it("returns 403 for member", async () => {
      const { response } = await callWsRoute("post", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("returns 400 for non-uuid templateId", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callWsRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { templateId: "not-uuid" },
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when template not in library", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(templatesRepo.templateExists).mockResolvedValue(false);

      const { response } = await callWsRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { templateId: TEMPLATE_ID },
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "template_not_found" }));
    });

    it("attaches template and returns 201", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(templatesRepo.templateExists).mockResolvedValue(true);
      vi.mocked(templatesRepo.attach).mockResolvedValue(true);

      const { response } = await callWsRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { templateId: TEMPLATE_ID },
      });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(templatesRepo.attach).toHaveBeenCalledWith(WS_ID, TEMPLATE_ID);
    });

    it("returns 409 when template already attached", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(templatesRepo.templateExists).mockResolvedValue(true);
      vi.mocked(templatesRepo.attach).mockRejectedValue(
        new TemplateAlreadyAttachedError(TEMPLATE_ID, WS_ID)
      );

      const { response } = await callWsRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { templateId: TEMPLATE_ID },
      });
      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "template_attached" }));
    });
  });

  // ── DELETE /:templateId ───────────────────────────────────────────────────

  describe("DELETE /:templateId", () => {
    it("returns 403 for member", async () => {
      const { response } = await callWsRoute("delete", "/:templateId", {
        user: MEMBER_USER,
        params: { id: WS_ID, templateId: TEMPLATE_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("detaches template and returns 204", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(templatesRepo.detach).mockResolvedValue(true);

      const { response } = await callWsRoute("delete", "/:templateId", {
        user: ADMIN_USER,
        params: { id: WS_ID, templateId: TEMPLATE_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(204);
      expect(templatesRepo.detach).toHaveBeenCalledWith(WS_ID, TEMPLATE_ID);
    });

    it("returns 404 when template not attached", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(templatesRepo.detach).mockResolvedValue(false);

      const { response } = await callWsRoute("delete", "/:templateId", {
        user: ADMIN_USER,
        params: { id: WS_ID, templateId: TEMPLATE_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns 404 for non-uuid templateId", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callWsRoute("delete", "/:templateId", {
        user: ADMIN_USER,
        params: { id: WS_ID, templateId: "bad-id" } as any,
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(templatesRepo.detach).not.toHaveBeenCalled();
    });

    it("forwards repo errors to next", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const boom = new Error("db down");
      vi.mocked(templatesRepo.detach).mockRejectedValue(boom);

      const { next } = await callWsRoute("delete", "/:templateId", {
        user: ADMIN_USER,
        params: { id: WS_ID, templateId: TEMPLATE_ID } as any,
      });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
