import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAuthRoutes } from "../auth-routes.js";
import type { AppContainer } from "../../container.js";
import type { User } from "@ai-connect/shared";
import type { Request, Response, NextFunction } from "express";

describe("Auth Routes", () => {
  let mockContainer: AppContainer;

  beforeEach(() => {
    mockContainer = {
      config: {
        JWT_EXPIRES_IN: "1h",
      },
      credentialsVerifier: {
        verify: vi.fn(),
      },
      jwtService: {
        sign: vi.fn(),
      },
    } as unknown as AppContainer;
  });

  function createMockRequest(body: any): Partial<Request> {
    return { body };
  }

  function createMockResponse() {
    const response: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return response;
  }

  async function callLoginRoute(body: any) {
    const router = createAuthRoutes(mockContainer);
    const mockRequest = createMockRequest(body) as Request;
    const mockResponse = createMockResponse() as Response;
    const mockNext = vi.fn() as NextFunction;

    // Find the POST /login handler in the router
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
    it("should return token on valid credentials", async () => {
      const testUser: User = { id: "user-123", username: "testuser" };

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(testUser);
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("jwt_token_123");

      const { response } = await callLoginRoute({
        username: "testuser",
        password: "correctpassword",
      });

      expect(response.json).toHaveBeenCalledWith({
        token: "jwt_token_123",
        expiresIn: "1h",
      });
      expect(response.status).not.toHaveBeenCalled();
    });

    it("should call credentialsVerifier with correct arguments", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue({
        id: "user-alice",
        username: "alice",
      });
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      await callLoginRoute({ username: "alice", password: "secret123" });

      expect(mockContainer.credentialsVerifier.verify).toHaveBeenCalledWith("alice", "secret123");
    });

    it("should call jwtService.sign with verified user", async () => {
      const testUser: User = { id: "user-123", username: "testuser" };

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(testUser);
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      await callLoginRoute({ username: "testuser", password: "password" });

      expect(mockContainer.jwtService.sign).toHaveBeenCalledWith(testUser);
    });

    it("should return expiresIn from config", async () => {
      mockContainer.config.JWT_EXPIRES_IN = "24h";

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue({
        id: "user-1",
        username: "user",
      });
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      const { response } = await callLoginRoute({ username: "user", password: "pass" });

      expect(response.json).toHaveBeenCalledWith({
        token: "token",
        expiresIn: "24h",
      });
    });
  });

  describe("POST /login - invalid credentials", () => {
    it("should return 401 for invalid password", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);

      const { response } = await callLoginRoute({
        username: "testuser",
        password: "wrongpassword",
      });

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_credentials",
        message: "Invalid username or password",
      });
    });

    it("should return 401 for unknown user", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);

      const { response } = await callLoginRoute({
        username: "unknownuser",
        password: "anypassword",
      });

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_credentials",
        message: "Invalid username or password",
      });
    });

    it("should not sign token on verification failure", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);

      await callLoginRoute({ username: "user", password: "wrong" });

      expect(mockContainer.jwtService.sign).not.toHaveBeenCalled();
    });

    it("should not expose whether user exists in error message", async () => {
      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);

      const { response } = await callLoginRoute({
        username: "unknownuser",
        password: "pass",
      });

      const errorMessage = ((response.json as any).mock.calls[0] as any[])[0].message;
      expect(errorMessage).toBe("Invalid username or password");
      // Message should be generic - doesn't say "unknown user" or "wrong password"
      expect(errorMessage).toMatch(/invalid/i);
    });
  });

  describe("POST /login - validation", () => {
    it("should return 400 for missing username", async () => {
      const { response } = await callLoginRoute({ password: "password" });

      expect(response.status).toHaveBeenCalledWith(400);
      const callArgs = ((response.json as any).mock.calls[0] as any[])[0];
      expect(callArgs.code).toBe("invalid_body");
      expect(callArgs.message).toMatch(/required|Required/i);
    });

    it("should return 400 for missing password", async () => {
      const { response } = await callLoginRoute({ username: "testuser" });

      expect(response.status).toHaveBeenCalledWith(400);
      const callArgs = ((response.json as any).mock.calls[0] as any[])[0];
      expect(callArgs.code).toBe("invalid_body");
      expect(callArgs.message).toMatch(/required|Required/i);
    });

    it("should return 400 for empty username", async () => {
      const { response } = await callLoginRoute({
        username: "",
        password: "password",
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_body",
        message: expect.stringContaining("required"),
      });
    });

    it("should return 400 for empty password", async () => {
      const { response } = await callLoginRoute({
        username: "testuser",
        password: "",
      });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_body",
        message: expect.stringContaining("required"),
      });
    });

    it("should return 400 for invalid body structure", async () => {
      const { response } = await callLoginRoute({ invalid: "structure" });

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        code: "invalid_body",
        message: expect.any(String),
      });
    });

    it("should accept extra fields in request body", async () => {
      const testUser: User = { id: "user-1", username: "user" };

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(testUser);
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      const { response } = await callLoginRoute({
        username: "user",
        password: "pass",
        extraField: "should be ignored",
        another: 123,
      });

      expect(response.json).toHaveBeenCalledWith({
        token: "token",
        expiresIn: "1h",
      });
      expect(response.status).not.toHaveBeenCalled();
    });
  });

  describe("POST /login - edge cases", () => {
    it("should handle whitespace in username and password", async () => {
      const testUser: User = { id: "user-1", username: "user with spaces" };

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(testUser);
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      const { response } = await callLoginRoute({
        username: "user with spaces",
        password: "pass with spaces",
      });

      expect(mockContainer.credentialsVerifier.verify).toHaveBeenCalledWith(
        "user with spaces",
        "pass with spaces"
      );
      expect(response.json).toHaveBeenCalledWith({
        token: "token",
        expiresIn: "1h",
      });
    });

    it("should handle very long username and password", async () => {
      const longUsername = "a".repeat(1000);
      const longPassword = "b".repeat(1000);

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(null);

      const { response } = await callLoginRoute({
        username: longUsername,
        password: longPassword,
      });

      expect(mockContainer.credentialsVerifier.verify).toHaveBeenCalledWith(
        longUsername,
        longPassword
      );
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it("should handle special characters in credentials", async () => {
      const testUser: User = { id: "user-1", username: "user@domain.com" };

      vi.mocked(mockContainer.credentialsVerifier.verify).mockResolvedValue(testUser);
      vi.mocked(mockContainer.jwtService.sign).mockReturnValue("token");

      const { response } = await callLoginRoute({
        username: "user@domain.com",
        password: "p@ssw0rd!#$%",
      });

      expect(response.json).toHaveBeenCalledWith({
        token: "token",
        expiresIn: "1h",
      });
    });
  });

  describe("router structure", () => {
    it("should have a POST /login route", () => {
      const router = createAuthRoutes(mockContainer);
      const stack = (router as any).stack;
      const loginRoute = stack.find((layer: any) => layer.route?.path === "/login");
      expect(loginRoute).toBeDefined();
      expect(loginRoute.route.methods.post).toBeDefined();
    });

    it("should only have login route", () => {
      const router = createAuthRoutes(mockContainer);
      const stack = (router as any).stack;
      const routes = stack.filter((layer: any) => layer.route);
      expect(routes.length).toBe(1);
    });
  });
});
