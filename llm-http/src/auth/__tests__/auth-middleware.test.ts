import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRequireAuth,
  createRequireOrgAdmin,
  createRequireWorkspaceAdmin,
} from "../auth-middleware.js";
import type { AppContainer } from "../../container.js";
import type { Request, Response, NextFunction } from "express";

function basePayload() {
  return {
    sub: "user-123",
    username: "testuser",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe("Auth Middleware", () => {
  let requireAuth: ReturnType<typeof createRequireAuth>;
  let mockContainer: AppContainer;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockContainer = {
      jwtService: { verify: vi.fn() },
      userRepository: {
        findByUsername: vi.fn().mockResolvedValue({
          id: "user-123",
          username: "testuser",
          passwordHash: "x",
          role: "member",
        }),
      },
    } as unknown as AppContainer;

    mockRequest = { headers: {} };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();

    requireAuth = createRequireAuth(mockContainer);
  });

  describe("missing authorization header", () => {
    it("returns 401 when header missing", () => {
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "missing_token",
        message: "Authorization header required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 401 when header empty", () => {
      mockRequest.headers = { authorization: "" };
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("invalid Bearer format", () => {
    it("returns 401 for non-Bearer scheme", () => {
      mockRequest.headers = { authorization: "Basic xyz" };
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("is case-sensitive on Bearer keyword", () => {
      mockRequest.headers = { authorization: "bearer token" };
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("valid token", () => {
    it("allows request with valid token", async () => {
      mockRequest.headers = { authorization: "Bearer validtoken" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue(basePayload());
      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("attaches identity plus system role to request", async () => {
      mockRequest.headers = { authorization: "Bearer t" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        ...basePayload(),
        sub: "user-456",
        username: "alice",
      });
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue({
        id: "user-456",
        username: "alice",
        passwordHash: "x",
        role: "admin",
      });

      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // System admin mirrors onto both orgRole and workspaceRole so the
      // not-yet-decommissioned admin routes stay reachable.
      expect(mockRequest.user).toEqual({
        id: "user-456",
        username: "alice",
        role: "admin",
        org: "default",
        orgRole: "admin",
        workspace: null,
        workspaceRole: "admin",
      });
    });

    it("maps a system member to null org/workspace roles", async () => {
      mockRequest.headers = { authorization: "Bearer t" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue(basePayload());
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue({
        id: "user-123",
        username: "testuser",
        passwordHash: "x",
        role: "member",
      });

      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user?.orgRole).toBe("member");
      expect(mockRequest.user?.workspaceRole).toBeNull();
    });

    it("returns 401 when user record no longer exists", async () => {
      mockRequest.headers = { authorization: "Bearer t" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue(basePayload());
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(null);

      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("invalid token", () => {
    it("returns 401 when verify throws", async () => {
      mockRequest.headers = { authorization: "Bearer bad" };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("invalid");
      });
      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "invalid_token",
        message: "Token invalid or expired",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe("createRequireOrgAdmin", () => {
  let mw: ReturnType<typeof createRequireOrgAdmin>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mw = createRequireOrgAdmin();
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("returns 403 when req.user is missing", () => {
    mw(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ code: "role_required", message: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when orgRole is member", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "member",
      workspace: null,
      workspaceRole: null,
    };
    mw(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when orgRole is admin", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "admin",
      workspace: null,
      workspaceRole: null,
    };
    mw(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("createRequireWorkspaceAdmin", () => {
  let mw: ReturnType<typeof createRequireWorkspaceAdmin>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mw = createRequireWorkspaceAdmin();
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("returns 403 when req.user is missing", () => {
    mw(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ code: "role_required", message: "Forbidden" });
  });

  it("returns 403 when workspaceRole is null", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "member",
      workspace: null,
      workspaceRole: null,
    };
    mw(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when workspaceRole is member", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "member",
      workspace: "w",
      workspaceRole: "member",
    };
    mw(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when workspaceRole is viewer", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "member",
      workspace: "w",
      workspaceRole: "viewer",
    };
    mw(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("calls next() when workspaceRole is admin", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "member",
      workspace: "w",
      workspaceRole: "admin",
    };
    mw(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next() when workspaceRole is owner", () => {
    req.user = {
      id: "u1",
      username: "u",
      role: "member",
      org: "o",
      orgRole: "member",
      workspace: "w",
      workspaceRole: "owner",
    };
    mw(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
