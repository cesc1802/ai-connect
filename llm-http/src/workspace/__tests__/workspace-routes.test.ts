import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createWorkspaceRoutes } from "../workspace-routes.js";
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

describe("Workspace Routes", () => {
  let repo: WorkspaceRepository;

  beforeEach(() => {
    repo = {
      listAll: vi.fn(),
      listForUser: vi.fn(),
      create: vi.fn(),
    };
  });

  function createMockResponse() {
    const response: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return response;
  }

  async function callRoute(
    method: "get" | "post",
    req: Partial<Request>
  ) {
    const router = createWorkspaceRoutes(repo);
    const mockRequest = { query: {}, body: {}, ...req } as Request;
    const mockResponse = createMockResponse() as Response;
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const layer = stack.find(
      (l: any) => l.route?.path === "/" && l.route?.methods?.[method]
    );
    if (!layer) throw new Error(`Route not found: ${method} /`);
    const handler = (layer.route.stack || [])[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, next: mockNext };
  }

  describe("GET / - auth and role branching", () => {
    it("returns 401 when req.user is missing", async () => {
      const { response } = await callRoute("get", {});

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "missing_token" })
      );
    });

    it("admin lists all workspaces with default paging", async () => {
      vi.mocked(repo.listAll).mockResolvedValue({ items: [], total: 0 });

      await callRoute("get", { user: ADMIN_USER });

      expect(repo.listAll).toHaveBeenCalledWith({ limit: 20, offset: 0 });
      expect(repo.listForUser).not.toHaveBeenCalled();
    });

    it("member lists only their workspaces", async () => {
      vi.mocked(repo.listForUser).mockResolvedValue({ items: [], total: 0 });

      await callRoute("get", { user: MEMBER_USER });

      expect(repo.listForUser).toHaveBeenCalledWith("user-member-1", {
        limit: 20,
        offset: 0,
      });
      expect(repo.listAll).not.toHaveBeenCalled();
    });

    it("translates page/limit into offset", async () => {
      vi.mocked(repo.listAll).mockResolvedValue({ items: [], total: 0 });

      await callRoute("get", {
        user: ADMIN_USER,
        query: { page: "3", limit: "10" } as any,
      });

      expect(repo.listAll).toHaveBeenCalledWith({ limit: 10, offset: 20 });
    });

    it("returns the paginated envelope", async () => {
      const items = [
        {
          id: "ws-1",
          slug: "alpha",
          name: "Alpha",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ];
      vi.mocked(repo.listAll).mockResolvedValue({ items, total: 42 });

      const { response } = await callRoute("get", {
        user: ADMIN_USER,
        query: { page: "2", limit: "5" } as any,
      });

      expect(response.json).toHaveBeenCalledWith({
        items,
        page: 2,
        limit: 5,
        total: 42,
      });
    });

    it("rejects limit above 100", async () => {
      const { response } = await callRoute("get", {
        user: ADMIN_USER,
        query: { limit: "500" } as any,
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "invalid_body" })
      );
      expect(repo.listAll).not.toHaveBeenCalled();
    });

    it("rejects page below 1", async () => {
      const { response } = await callRoute("get", {
        user: ADMIN_USER,
        query: { page: "0" } as any,
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "invalid_body" })
      );
    });

    it("forwards repository errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(repo.listAll).mockRejectedValue(boom);

      const { next } = await callRoute("get", { user: ADMIN_USER });

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe("POST / - admin guard and creation", () => {
    it("returns 401 when req.user is missing", async () => {
      const { response } = await callRoute("post", {});

      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member without calling the repo", async () => {
      const { response } = await callRoute("post", {
        user: MEMBER_USER,
        body: { name: "Nope" },
      });

      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "role_required" })
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("creates with slug derived from name", async () => {
      const created = {
        id: "ws-1",
        slug: "team-rocket",
        name: "Team Rocket",
        createdAt: new Date(),
      };
      vi.mocked(repo.create).mockResolvedValue(created);

      const { response } = await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "Team Rocket" },
      });

      expect(repo.create).toHaveBeenCalledWith({
        slug: "team-rocket",
        name: "Team Rocket",
      });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith(created);
    });

    it("truncates a derived slug to 50 chars without a trailing hyphen", async () => {
      const longName = "a".repeat(49) + " " + "b".repeat(50);
      vi.mocked(repo.create).mockResolvedValue({
        id: "ws-3",
        slug: "a".repeat(49),
        name: longName,
        createdAt: new Date(),
      });

      await callRoute("post", {
        user: ADMIN_USER,
        body: { name: longName },
      });

      // 49 a's + hyphen hits the 50 cap; the trailing hyphen is trimmed.
      expect(repo.create).toHaveBeenCalledWith({
        slug: "a".repeat(49),
        name: longName,
      });
    });

    it("passes an explicit valid slug through", async () => {
      vi.mocked(repo.create).mockResolvedValue({
        id: "ws-2",
        slug: "custom-slug",
        name: "Anything",
        createdAt: new Date(),
      });

      await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "Anything", slug: "custom-slug" },
      });

      expect(repo.create).toHaveBeenCalledWith({
        slug: "custom-slug",
        name: "Anything",
      });
    });

    it("rejects an invalid slug format", async () => {
      const { response } = await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "Anything", slug: "Bad Slug!" },
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects an empty name", async () => {
      const { response } = await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "   " },
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a name whose derived slug is empty", async () => {
      const { response } = await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "!!!" },
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "invalid_body" })
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("maps SlugTakenError to 409 slug_taken", async () => {
      vi.mocked(repo.create).mockRejectedValue(new SlugTakenError("taken"));

      const { response } = await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "Taken", slug: "taken" },
      });

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "slug_taken" })
      );
    });

    it("forwards unexpected repository errors to next", async () => {
      const boom = new Error("db down");
      vi.mocked(repo.create).mockRejectedValue(boom);

      const { next } = await callRoute("post", {
        user: ADMIN_USER,
        body: { name: "Boom" },
      });

      expect(next).toHaveBeenCalledWith(boom);
    });
  });
});
