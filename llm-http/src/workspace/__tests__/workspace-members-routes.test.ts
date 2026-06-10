import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createWorkspaceMembersRoutes } from "../workspace-members-routes.js";
import {
  MemberExistsError,
  MemberNotFoundError,
  type WorkspaceMembersRepository,
} from "../workspace-members-repository.js";
import type { WorkspaceRepository } from "../workspace-repository.js";

const ADMIN_USER = { id: "00000000-0000-0000-0000-000000000001", username: "admin", role: "admin" } as Request["user"];
const MEMBER_USER = { id: "00000000-0000-0000-0000-000000000002", username: "mem", role: "member" } as Request["user"];

const WS_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const USER_ID = "bbbbbbbb-0000-0000-0000-000000000001";

const WS_SUMMARY = { id: WS_ID, slug: "alpha", name: "Alpha", createdAt: new Date() };

describe("Workspace Members Routes", () => {
  let membersRepo: WorkspaceMembersRepository;
  let workspaceRepo: WorkspaceRepository;

  beforeEach(() => {
    membersRepo = {
      list: vi.fn(),
      listCandidates: vi.fn(),
      add: vi.fn(),
      replaceRoles: vi.fn(),
      remove: vi.fn(),
      isMember: vi.fn(),
      userExists: vi.fn(),
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

  /** Finds and calls the handler for a given method + path pattern in the router stack. */
  async function callRoute(
    method: "get" | "post" | "patch" | "delete",
    routePath: string,
    req: Partial<Request>
  ) {
    const router = createWorkspaceMembersRoutes(membersRepo, workspaceRepo);
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

  // ── GET / ────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("get", "/", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 404 for non-uuid workspace id", async () => {
      const { response } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: "not-uuid" } as any });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(workspaceRepo.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when workspace not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(null);
      const { response } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns members list for admin", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const mockMembers = [{ userId: USER_ID, username: "u", wsRoles: ["dev"] as any, orgRole: "member" }];
      vi.mocked(membersRepo.list).mockResolvedValue(mockMembers);

      const { response } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ members: mockMembers });
      expect(workspaceRepo.isMember).not.toHaveBeenCalled();
    });

    it("returns 404 for member on foreign workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(false);

      const { response } = await callRoute("get", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it("returns members for a member of own workspace", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(workspaceRepo.isMember).mockResolvedValue(true);
      vi.mocked(membersRepo.list).mockResolvedValue([]);

      const { response } = await callRoute("get", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ members: [] });
    });

    it("forwards repo errors to next", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const boom = new Error("db down");
      vi.mocked(membersRepo.list).mockRejectedValue(boom);

      const { next } = await callRoute("get", "/", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ── GET /candidates ───────────────────────────────────────────────────────

  describe("GET /candidates", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("get", "/candidates", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for non-admin", async () => {
      const { response } = await callRoute("get", "/candidates", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("returns candidates list for admin", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const mockCandidates = [{ userId: USER_ID, username: "u", orgRole: "member" }];
      vi.mocked(membersRepo.listCandidates).mockResolvedValue(mockCandidates);

      const { response } = await callRoute("get", "/candidates", { user: ADMIN_USER, params: { id: WS_ID } as any });
      expect(response.json).toHaveBeenCalledWith({ candidates: mockCandidates });
    });
  });

  // ── POST / ────────────────────────────────────────────────────────────────

  describe("POST /", () => {
    it("returns 401 when no user", async () => {
      const { response } = await callRoute("post", "/", { user: undefined, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for member", async () => {
      const { response } = await callRoute("post", "/", { user: MEMBER_USER, params: { id: WS_ID } as any });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("returns 400 for invalid body", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { userId: "not-uuid", roles: ["dev"] },
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 for empty roles array", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      const { response } = await callRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { userId: USER_ID, roles: [] },
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 404 when user not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.userExists).mockResolvedValue(false);
      const { response } = await callRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { userId: USER_ID, roles: ["dev"] },
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "user_not_found" }));
    });

    it("adds a member and returns 201", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.userExists).mockResolvedValue(true);
      vi.mocked(membersRepo.add).mockResolvedValue();

      const { response } = await callRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { userId: USER_ID, roles: ["dev", "qa"] },
      });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(membersRepo.add).toHaveBeenCalledWith(WS_ID, USER_ID, ["dev", "qa"]);
    });

    it("dedupes repeated roles before persisting", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.userExists).mockResolvedValue(true);
      vi.mocked(membersRepo.add).mockResolvedValue();

      const { response } = await callRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { userId: USER_ID, roles: ["dev", "dev", "qa"] },
      });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(membersRepo.add).toHaveBeenCalledWith(WS_ID, USER_ID, ["dev", "qa"]);
    });

    it("returns 409 when member already exists", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.userExists).mockResolvedValue(true);
      vi.mocked(membersRepo.add).mockRejectedValue(new MemberExistsError(USER_ID, WS_ID));

      const { response } = await callRoute("post", "/", {
        user: ADMIN_USER,
        params: { id: WS_ID } as any,
        body: { userId: USER_ID, roles: ["dev"] },
      });
      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "member_exists" }));
    });
  });

  // ── PATCH /:userId ────────────────────────────────────────────────────────

  describe("PATCH /:userId", () => {
    it("returns 403 for member", async () => {
      const { response } = await callRoute("patch", "/:userId", { user: MEMBER_USER, params: { id: WS_ID, userId: USER_ID } as any });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("replaces roles and returns updated set", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.replaceRoles).mockResolvedValue();

      const { response } = await callRoute("patch", "/:userId", {
        user: ADMIN_USER,
        params: { id: WS_ID, userId: USER_ID } as any,
        body: { roles: ["pm"] },
      });
      expect(response.json).toHaveBeenCalledWith({ userId: USER_ID, roles: ["pm"] });
    });

    it("returns 404 when member not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.replaceRoles).mockRejectedValue(new MemberNotFoundError(USER_ID, WS_ID));

      const { response } = await callRoute("patch", "/:userId", {
        user: ADMIN_USER,
        params: { id: WS_ID, userId: USER_ID } as any,
        body: { roles: ["pm"] },
      });
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: "member_not_found" }));
    });
  });

  // ── DELETE /:userId ───────────────────────────────────────────────────────

  describe("DELETE /:userId", () => {
    it("returns 403 for member", async () => {
      const { response } = await callRoute("delete", "/:userId", { user: MEMBER_USER, params: { id: WS_ID, userId: USER_ID } as any });
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it("removes member and returns 204", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.remove).mockResolvedValue(true);

      const { response } = await callRoute("delete", "/:userId", {
        user: ADMIN_USER,
        params: { id: WS_ID, userId: USER_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(204);
      expect(membersRepo.remove).toHaveBeenCalledWith(WS_ID, USER_ID);
    });

    it("returns 404 when member not found", async () => {
      vi.mocked(workspaceRepo.getById).mockResolvedValue(WS_SUMMARY);
      vi.mocked(membersRepo.remove).mockResolvedValue(false);

      const { response } = await callRoute("delete", "/:userId", {
        user: ADMIN_USER,
        params: { id: WS_ID, userId: USER_ID } as any,
      });
      expect(response.status).toHaveBeenCalledWith(404);
    });
  });
});
