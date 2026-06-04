import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAuthRoutes } from "../auth-routes.js";
import type { AppContainer } from "../../container.js";
import type { User } from "@ai-connect/shared";
import type { UserRecord } from "../user-repository.js";
import type { Request, Response, NextFunction } from "express";

function makeRecord(user: User, overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: user.id,
    username: user.username,
    passwordHash: "x",
    org: "demo-org",
    orgRole: "member",
    workspace: null,
    workspaceRole: null,
    ...overrides,
  };
}

describe("Auth Routes", () => {
  let mockContainer: AppContainer;

  beforeEach(() => {
    mockContainer = {
      config: { JWT_EXPIRES_IN: "1h" },
      credentialsVerifier: { verify: vi.fn() },
      jwtService: { sign: vi.fn() },
      userRepository: { findByUsername: vi.fn() },
    } as unknown as AppContainer;
  });

  function createMockRequest(body: unknown): Partial<Request> {
    return { body };
  }

  function createMockResponse() {
    const response: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return response;
  }

  async function callLoginRoute(body: unknown) {
    const router = createAuthRoutes(mockContainer);
    const mockRequest = createMockRequest(body) as Request;
    const mockResponse = createMockResponse() as Response;
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const loginRoute = stack.find((layer: any) => layer.route?.path === "/login");
    if (!loginRoute) throw new Error("Login route not found");

    const handlers = loginRoute.route.stack || [];
    const handler = handlers[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, request: mockRequest };
  }

  describe("POST /login - successful authentication", () => {
    it("returns token on valid credentials", async () => {
      const user: User = { id: "user-123", username: "testuser" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(
        makeRecord(user, { org: "org-7", orgRole: "admin" }),
      );
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("jwt_token_123");

      const { response } = await callLoginRoute({
        username: "testuser",
        password: "correct",
      });

      expect(response.json).toHaveBeenCalledWith({
        token: "jwt_token_123",
        expiresIn: "1h",
      });
      expect(response.status).not.toHaveBeenCalled();
    });

    it("passes sign context with org/role claims", async () => {
      const user: User = { id: "u1", username: "alice" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(
        makeRecord(user, {
          org: "org-7",
          orgRole: "admin",
          workspace: "ws-1",
          workspaceRole: "owner",
        }),
      );
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("tok");

      await callLoginRoute({ username: "alice", password: "p" });

      expect(mockContainer.jwtService.sign).toHaveBeenCalledWith(user, {
        org: "org-7",
        orgRole: "admin",
        workspace: "ws-1",
        workspaceRole: "owner",
      });
    });

    it("normalises missing workspace to null", async () => {
      const user: User = { id: "u1", username: "bob" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(
        makeRecord(user),
      );
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("tok");

      await callLoginRoute({ username: "bob", password: "p" });

      const [, ctx] = vi.mocked(mockContainer.jwtService.sign).mock.calls[0]!;
      expect(ctx).toEqual({
        org: "demo-org",
        orgRole: "member",
        workspace: null,
        workspaceRole: null,
      });
    });

    it("calls credentialsVerifier with correct arguments", async () => {
      const user: User = { id: "user-alice", username: "alice" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(
        makeRecord(user),
      );
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      await callLoginRoute({ username: "alice", password: "secret123" });

      expect(mockContainer.credentialsVerifier.verify).toHaveBeenCalledWith(
        "alice",
        "secret123",
      );
    });

    it("returns expiresIn from config", async () => {
      mockContainer.config.JWT_EXPIRES_IN = "24h";
      const user: User = { id: "u", username: "u" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(
        makeRecord(user),
      );
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      const { response } = await callLoginRoute({ username: "u", password: "p" });

      expect(response.json).toHaveBeenCalledWith({ token: "token", expiresIn: "24h" });
    });
  });

  describe("POST /login - invalid credentials", () => {
    it("returns 401 for invalid password", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);
      const { response } = await callLoginRoute({
        username: "testuser",
        password: "wrong",
      });
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_credentials",
        message: "Invalid username or password",
      });
    });

    it("returns 401 when user record disappears between verify and lookup", async () => {
      const user: User = { id: "u", username: "u" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(null);

      const { response } = await callLoginRoute({ username: "u", password: "p" });

      expect(response.status).toHaveBeenCalledWith(401);
      expect(mockContainer.jwtService.sign).not.toHaveBeenCalled();
    });

    it("does not sign token on verification failure", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);
      await callLoginRoute({ username: "user", password: "wrong" });
      expect(mockContainer.jwtService.sign).not.toHaveBeenCalled();
    });

    it("does not leak whether user exists in error message", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);
      const { response } = await callLoginRoute({
        username: "unknown",
        password: "p",
      });
      const msg = ((response.json as any).mock.calls[0] as any[])[0].message;
      expect(msg).toBe("Invalid username or password");
    });
  });

  describe("POST /login - validation", () => {
    it("returns 400 for missing username", async () => {
      const { response } = await callLoginRoute({ password: "password" });
      expect(response.status).toHaveBeenCalledWith(400);
      const args = ((response.json as any).mock.calls[0] as any[])[0];
      expect(args.code).toBe("invalid_body");
    });

    it("returns 400 for missing password", async () => {
      const { response } = await callLoginRoute({ username: "u" });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 for empty username", async () => {
      const { response } = await callLoginRoute({ username: "", password: "p" });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 for empty password", async () => {
      const { response } = await callLoginRoute({ username: "u", password: "" });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("accepts extra fields", async () => {
      const user: User = { id: "u", username: "user" };
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(user);
      vi.mocked(mockContainer.userRepository.findByUsername).mockResolvedValue(
        makeRecord(user),
      );
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      const { response } = await callLoginRoute({
        username: "user",
        password: "p",
        extra: 1,
      });

      expect(response.json).toHaveBeenCalledWith({ token: "token", expiresIn: "1h" });
    });
  });

  describe("router structure", () => {
    it("has POST /login", () => {
      const router = createAuthRoutes(mockContainer);
      const stack = (router as any).stack;
      const loginRoute = stack.find((layer: any) => layer.route?.path === "/login");
      expect(loginRoute).toBeDefined();
      expect(loginRoute.route.methods.post).toBeDefined();
    });
  });
});
