import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createPromptTemplatesRoutes } from "../prompt-templates-routes.js";
import {
  TemplateInUseError,
  type WorkspaceTemplatesRepository,
} from "../workspace-templates-repository.js";

const ADMIN_USER = { id: "00000000-0000-0000-0000-000000000001", username: "admin", role: "admin" } as Request["user"];
const MEMBER_USER = { id: "00000000-0000-0000-0000-000000000002", username: "mem", role: "member" } as Request["user"];

const TEMPLATE_ID = "dddddddd-0000-0000-0000-000000000001";
const TEMPLATE_ROW = {
  id: TEMPLATE_ID, slug: "t1", title: "Review PR", category: "Kỹ thuật",
  icon: "code", authorName: "admin", uses: 0, description: "desc", body: null,
};

const VALID_CREATE = {
  title: "Review PR",
  category: "Kỹ thuật",
  icon: "code",
  description: "desc",
};

describe("Prompt Templates CRUD Routes", () => {
  let templatesRepo: WorkspaceTemplatesRepository;

  beforeEach(() => {
    templatesRepo = {
      listLibrary: vi.fn(),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      listForWorkspace: vi.fn(),
      getTemplate: vi.fn(),
      attach: vi.fn(),
      detach: vi.fn(),
      templateExists: vi.fn(),
    };
  });

  function mockRes() {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    return res as Response;
  }

  async function callRoute(
    method: "get" | "post" | "patch" | "delete",
    routePath: string,
    req: Partial<Request>
  ) {
    const router = createPromptTemplatesRoutes(templatesRepo);
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

  // ── POST / ────────────────────────────────────────────────────────────────

  describe("POST /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("post", "/", { user: undefined, body: VALID_CREATE });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member", async () => {
      const { response } = await callRoute("post", "/", { user: MEMBER_USER, body: VALID_CREATE });
      expect(response.status).toHaveBeenCalledWith(403);
      expect(templatesRepo.createTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid payload", async () => {
      const { response } = await callRoute("post", "/", { user: ADMIN_USER, body: { title: "" } });
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "invalid_input" }));
    });

    it("creates template with author + generated slug and returns 201", async () => {
      vi.mocked(templatesRepo.createTemplate).mockResolvedValue(TEMPLATE_ROW);

      const { response } = await callRoute("post", "/", { user: ADMIN_USER, body: VALID_CREATE });
      expect(templatesRepo.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          ...VALID_CREATE,
          slug: expect.stringMatching(/^tpl-/),
          authorName: "admin",
          body: null,
        })
      );
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith({ template: TEMPLATE_ROW });
    });

    it("normalizes a blank prompt body to null", async () => {
      vi.mocked(templatesRepo.createTemplate).mockResolvedValue(TEMPLATE_ROW);

      await callRoute("post", "/", {
        user: ADMIN_USER,
        body: { ...VALID_CREATE, body: "   " },
      });
      expect(templatesRepo.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ body: null })
      );
    });

    it("passes prompt body through when provided", async () => {
      vi.mocked(templatesRepo.createTemplate).mockResolvedValue({ ...TEMPLATE_ROW, body: "Hello {{name}}" });

      await callRoute("post", "/", {
        user: ADMIN_USER,
        body: { ...VALID_CREATE, body: "Hello {{name}}" },
      });
      expect(templatesRepo.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ body: "Hello {{name}}" })
      );
    });

    it("forwards repo errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(templatesRepo.createTemplate).mockRejectedValue(boom);
      const { next } = await callRoute("post", "/", { user: ADMIN_USER, body: VALID_CREATE });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────

  describe("PATCH /:id", () => {
    it("returns 403 for member", async () => {
      const { response } = await callRoute("patch", "/:id", {
        user: MEMBER_USER, params: { id: TEMPLATE_ID } as any, body: { title: "New" },
      });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("returns 404 for non-uuid id", async () => {
      const { response } = await callRoute("patch", "/:id", {
        user: ADMIN_USER, params: { id: "bad" } as any, body: { title: "New" },
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(templatesRepo.updateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 for empty patch body", async () => {
      const { response } = await callRoute("patch", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any, body: {},
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when template unknown", async () => {
      vi.mocked(templatesRepo.updateTemplate).mockResolvedValue(undefined);
      const { response } = await callRoute("patch", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any, body: { title: "New" },
      });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("clears the prompt body when patched with a blank string", async () => {
      vi.mocked(templatesRepo.updateTemplate).mockResolvedValue(TEMPLATE_ROW);

      await callRoute("patch", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any, body: { body: "" },
      });
      expect(templatesRepo.updateTemplate).toHaveBeenCalledWith(TEMPLATE_ID, { body: null });
    });

    it("updates and returns the template", async () => {
      const updated = { ...TEMPLATE_ROW, title: "New" };
      vi.mocked(templatesRepo.updateTemplate).mockResolvedValue(updated);

      const { response } = await callRoute("patch", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any, body: { title: "New" },
      });
      expect(templatesRepo.updateTemplate).toHaveBeenCalledWith(TEMPLATE_ID, { title: "New" });
      expect(response.json).toHaveBeenCalledWith({ template: updated });
    });
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────

  describe("DELETE /:id", () => {
    it("returns 403 for member", async () => {
      const { response } = await callRoute("delete", "/:id", {
        user: MEMBER_USER, params: { id: TEMPLATE_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(403);
      expect(templatesRepo.deleteTemplate).not.toHaveBeenCalled();
    });

    it("returns 404 for non-uuid id", async () => {
      const { response } = await callRoute("delete", "/:id", {
        user: ADMIN_USER, params: { id: "bad" } as any,
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(templatesRepo.deleteTemplate).not.toHaveBeenCalled();
    });

    it("returns 404 when template unknown", async () => {
      vi.mocked(templatesRepo.deleteTemplate).mockResolvedValue(false);
      const { response } = await callRoute("delete", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("deletes and returns 204", async () => {
      vi.mocked(templatesRepo.deleteTemplate).mockResolvedValue(true);
      const { response } = await callRoute("delete", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any,
      });
      expect(templatesRepo.deleteTemplate).toHaveBeenCalledWith(TEMPLATE_ID);
      expect(response.status).toHaveBeenCalledWith(204);
      expect(response.send).toHaveBeenCalled();
    });

    it("returns 409 when template attached to a workspace", async () => {
      vi.mocked(templatesRepo.deleteTemplate).mockRejectedValue(new TemplateInUseError(TEMPLATE_ID));
      const { response } = await callRoute("delete", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "template_in_use" }));
    });

    it("forwards unexpected repo errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(templatesRepo.deleteTemplate).mockRejectedValue(boom);
      const { next } = await callRoute("delete", "/:id", {
        user: ADMIN_USER, params: { id: TEMPLATE_ID } as any,
      });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
