import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createWorkspaceByIdRoutes } from "../workspace-by-id-routes.js";
import {
  SlugTakenError,
  type WorkspaceRepository,
} from "../workspace-repository.js";

const ADMIN_USER = {
  id: "user-admin-1",
  username: "ada",
  role: "admin",
} as Request["user"];

const MEMBER_USER = {
  id: "user-member-1",
  username: "mem",
  role: "member",
} as Request["user"];

const WS_ID = "6f1f2d3a-4b5c-4d6e-8f90-123456789abc";

const SUMMARY = {
  id: WS_ID,
  slug: "alpha",
  name: "Alpha",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("Workspace By-Id Routes", () => {
  let repo: WorkspaceRepository;

  beforeEach(() => {
    repo = {
      listAll: vi.fn(),
      listForUser: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
      isMember: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
  });

  function createMockResponse() {
    const response: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    return response;
  }

  async function callRoute(
    method: "get" | "patch" | "delete",
    req: Partial<Request>
  ) {
    const router = createWorkspaceByIdRoutes(repo);
    const mockRequest = {
      params: { id: WS_ID },
      query: {},
      body: {},
      ...req,
    } as unknown as Request;
    const mockResponse = createMockResponse() as Response;
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const layer = stack.find(
      (l: any) => l.route?.path === "/:id" && l.route?.methods?.[method]
    );
    if (!layer) throw new Error(`Route not found: ${method} /:id`);
    const handler = (layer.route.stack || [])[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, next: mockNext };
  }

  describe("GET /:id", () => {
    it("returns 401 when req.user is missing", async () => {
      const { response } = await callRoute("get", { user: undefined });

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "missing_token" })
      );
    });

    it("returns 404 for a non-uuid id without touching the repo", async () => {
      const { response } = await callRoute("get", {
        user: ADMIN_USER,
        params: { id: "not-a-uuid" } as any,
      });

      expect(response.status).toHaveBeenCalledWith(404);
      expect(repo.getById).not.toHaveBeenCalled();
    });

    it("returns the workspace for an admin", async () => {
      vi.mocked(repo.getById).mockResolvedValue(SUMMARY);

      const { response } = await callRoute("get", { user: ADMIN_USER });

      expect(repo.getById).toHaveBeenCalledWith(WS_ID);
      expect(repo.isMember).not.toHaveBeenCalled();
      expect(response.json).toHaveBeenCalledWith(SUMMARY);
    });

    it("returns the workspace for a member who belongs to it", async () => {
      vi.mocked(repo.getById).mockResolvedValue(SUMMARY);
      vi.mocked(repo.isMember).mockResolvedValue(true);

      const { response } = await callRoute("get", { user: MEMBER_USER });

      expect(repo.isMember).toHaveBeenCalledWith("user-member-1", WS_ID);
      expect(response.json).toHaveBeenCalledWith(SUMMARY);
    });

    it("returns 404 (not 403) for a member of a foreign workspace", async () => {
      vi.mocked(repo.getById).mockResolvedValue(SUMMARY);
      vi.mocked(repo.isMember).mockResolvedValue(false);

      const { response } = await callRoute("get", { user: MEMBER_USER });

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "workspace_not_found" })
      );
    });

    it("returns 404 when the workspace is absent or deleted", async () => {
      vi.mocked(repo.getById).mockResolvedValue(null);

      const { response } = await callRoute("get", { user: ADMIN_USER });

      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("forwards repository errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(repo.getById).mockRejectedValue(boom);

      const { next } = await callRoute("get", { user: ADMIN_USER });

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe("PATCH /:id", () => {
    it("returns 401 when req.user is missing", async () => {
      const { response } = await callRoute("patch", { user: undefined });

      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member without calling the repo", async () => {
      const { response } = await callRoute("patch", {
        user: MEMBER_USER,
        body: { name: "Nope" },
      });

      expect(response.status).toHaveBeenCalledWith(403);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("returns 404 for a non-uuid id", async () => {
      const { response } = await callRoute("patch", {
        user: ADMIN_USER,
        params: { id: "nope" } as any,
        body: { name: "X" },
      });

      expect(response.status).toHaveBeenCalledWith(404);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejects an empty body", async () => {
      const { response } = await callRoute("patch", {
        user: ADMIN_USER,
        body: {},
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "invalid_body" })
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejects an invalid slug format", async () => {
      const { response } = await callRoute("patch", {
        user: ADMIN_USER,
        body: { slug: "Bad Slug!" },
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("updates name and slug and returns the summary", async () => {
      const updated = { ...SUMMARY, name: "Renamed", slug: "renamed" };
      vi.mocked(repo.update).mockResolvedValue(updated);

      const { response } = await callRoute("patch", {
        user: ADMIN_USER,
        body: { name: "Renamed", slug: "renamed" },
      });

      expect(repo.update).toHaveBeenCalledWith(WS_ID, {
        name: "Renamed",
        slug: "renamed",
      });
      expect(response.json).toHaveBeenCalledWith(updated);
    });

    it("accepts a name-only patch", async () => {
      vi.mocked(repo.update).mockResolvedValue({ ...SUMMARY, name: "Solo" });

      await callRoute("patch", {
        user: ADMIN_USER,
        body: { name: "Solo" },
      });

      expect(repo.update).toHaveBeenCalledWith(WS_ID, { name: "Solo" });
    });

    it("returns 404 when the workspace is absent or deleted", async () => {
      vi.mocked(repo.update).mockResolvedValue(null);

      const { response } = await callRoute("patch", {
        user: ADMIN_USER,
        body: { name: "Ghost" },
      });

      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("maps SlugTakenError to 409 slug_taken", async () => {
      vi.mocked(repo.update).mockRejectedValue(new SlugTakenError("taken"));

      const { response } = await callRoute("patch", {
        user: ADMIN_USER,
        body: { slug: "taken" },
      });

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "slug_taken" })
      );
    });

    it("forwards unexpected repository errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(repo.update).mockRejectedValue(boom);

      const { next } = await callRoute("patch", {
        user: ADMIN_USER,
        body: { name: "Boom" },
      });

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe("DELETE /:id", () => {
    it("returns 401 when req.user is missing", async () => {
      const { response } = await callRoute("delete", { user: undefined });

      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member without calling the repo", async () => {
      const { response } = await callRoute("delete", { user: MEMBER_USER });

      expect(response.status).toHaveBeenCalledWith(403);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it("returns 404 for a non-uuid id", async () => {
      const { response } = await callRoute("delete", {
        user: ADMIN_USER,
        params: { id: "nope" } as any,
      });

      expect(response.status).toHaveBeenCalledWith(404);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it("soft-deletes and returns 204", async () => {
      vi.mocked(repo.softDelete).mockResolvedValue(true);

      const { response } = await callRoute("delete", { user: ADMIN_USER });

      expect(repo.softDelete).toHaveBeenCalledWith(WS_ID);
      expect(response.status).toHaveBeenCalledWith(204);
      expect(response.send).toHaveBeenCalled();
    });

    it("returns 404 when already deleted or absent", async () => {
      vi.mocked(repo.softDelete).mockResolvedValue(false);

      const { response } = await callRoute("delete", { user: ADMIN_USER });

      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("forwards repository errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(repo.softDelete).mockRejectedValue(boom);

      const { next } = await callRoute("delete", { user: ADMIN_USER });

      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
