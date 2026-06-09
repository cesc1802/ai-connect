import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAuthRoutes } from "../auth-routes.js";
import { UsernameTakenError } from "../user-repository.js";
import type { AppContainer } from "../../container.js";
import type { Request, Response, NextFunction } from "express";

describe("Auth Routes", () => {
  let mockContainer: AppContainer;

  beforeEach(() => {
    mockContainer = {
      authService: { login: vi.fn(), register: vi.fn() },
    } as unknown as AppContainer;
  });

  function createMockResponse() {
    const response: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return response;
  }

  async function callRoute(path: string, body: unknown) {
    const router = createAuthRoutes(mockContainer);
    const mockRequest = { body } as Request;
    const mockResponse = createMockResponse() as Response;
    const mockNext = vi.fn() as NextFunction;

    const stack = (router as any).stack;
    const layer = stack.find((l: any) => l.route?.path === path);
    if (!layer) throw new Error(`Route not found: ${path}`);
    const handler = (layer.route.stack || [])[0]?.handle;
    if (!handler) throw new Error("Handler not found");

    await handler(mockRequest, mockResponse, mockNext);
    return { response: mockResponse, next: mockNext };
  }

  describe("POST /login - success", () => {
    it("returns the service login result", async () => {
      vi.mocked(mockContainer.authService.login).mockResolvedValue({
        token: "jwt_token_123",
        expiresIn: "1h",
      });

      const { response } = await callRoute("/login", {
        username: "testuser",
        password: "correct",
      });

      expect(mockContainer.authService.login).toHaveBeenCalledWith(
        "testuser",
        "correct",
      );
      expect(response.json).toHaveBeenCalledWith({
        token: "jwt_token_123",
        expiresIn: "1h",
      });
      expect(response.status).not.toHaveBeenCalled();
    });
  });

  describe("POST /login - invalid credentials", () => {
    it("returns 401 when the service returns null", async () => {
      vi.mocked(mockContainer.authService.login).mockResolvedValue(null);

      const { response } = await callRoute("/login", {
        username: "testuser",
        password: "wrong",
      });

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_credentials",
        message: "Invalid username or password",
      });
    });

    it("does not leak whether the user exists", async () => {
      vi.mocked(mockContainer.authService.login).mockResolvedValue(null);
      const { response } = await callRoute("/login", {
        username: "unknown",
        password: "p",
      });
      const msg = ((response.json as any).mock.calls[0] as any[])[0].message;
      expect(msg).toBe("Invalid username or password");
    });
  });

  describe("POST /login - validation", () => {
    it("returns 400 for missing username", async () => {
      const { response } = await callRoute("/login", { password: "password" });
      expect(response.status).toHaveBeenCalledWith(400);
      const args = ((response.json as any).mock.calls[0] as any[])[0];
      expect(args.code).toBe("invalid_body");
    });

    it("returns 400 for empty password", async () => {
      const { response } = await callRoute("/login", {
        username: "u",
        password: "",
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("does not call the service on invalid body", async () => {
      await callRoute("/login", { username: "u" });
      expect(mockContainer.authService.login).not.toHaveBeenCalled();
    });
  });

  describe("POST /register - success", () => {
    it("returns 201 with the created user (no password hash)", async () => {
      vi.mocked(mockContainer.authService.register).mockResolvedValue({
        id: "user-1",
        username: "alice",
        passwordHash: "hashed",
        role: "member",
      });

      const { response } = await callRoute("/register", {
        username: "alice",
        password: "password123",
      });

      expect(mockContainer.authService.register).toHaveBeenCalledWith(
        "alice",
        "password123",
      );
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith({
        id: "user-1",
        username: "alice",
      });
    });
  });

  describe("POST /register - conflicts and validation", () => {
    it("returns 409 when the username is taken", async () => {
      vi.mocked(mockContainer.authService.register).mockRejectedValue(
        new UsernameTakenError("alice"),
      );

      const { response } = await callRoute("/register", {
        username: "alice",
        password: "password123",
      });

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith({
        code: "username_taken",
        message: "Username is already taken",
      });
    });

    it("returns 400 when the password is too short", async () => {
      const { response } = await callRoute("/register", {
        username: "alice",
        password: "short",
      });
      expect(response.status).toHaveBeenCalledWith(400);
      expect(mockContainer.authService.register).not.toHaveBeenCalled();
    });

    it("returns 400 when the username is too short", async () => {
      const { response } = await callRoute("/register", {
        username: "al",
        password: "password123",
      });
      expect(response.status).toHaveBeenCalledWith(400);
    });

    it("forwards unexpected errors to next()", async () => {
      vi.mocked(mockContainer.authService.register).mockRejectedValue(
        new Error("db down"),
      );

      const { response, next } = await callRoute("/register", {
        username: "alice",
        password: "password123",
      });

      expect(next).toHaveBeenCalled();
      expect(response.status).not.toHaveBeenCalledWith(409);
    });
  });

  describe("router structure", () => {
    it("exposes POST /login and POST /register", () => {
      const router = createAuthRoutes(mockContainer);
      const stack = (router as any).stack;
      const paths = stack
        .filter((l: any) => l.route)
        .map((l: any) => l.route.path);
      expect(paths).toContain("/login");
      expect(paths).toContain("/register");
    });
  });
});
