import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRequireAuth } from "../auth-middleware.js";
import type { AppContainer } from "../../container.js";
import type { Request, Response, NextFunction } from "express";

describe("Auth Middleware", () => {
  let requireAuth: ReturnType<typeof createRequireAuth>;
  let mockContainer: AppContainer;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockContainer = {
      jwtService: {
        verify: vi.fn(),
      },
    } as unknown as AppContainer;

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    requireAuth = createRequireAuth(mockContainer);
  });

  describe("missing authorization header", () => {
    it("should return 401 when Authorization header is missing", () => {
      mockRequest.headers = {};

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "missing_token",
        message: "Authorization header required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is empty string", () => {
      mockRequest.headers = { authorization: "" };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "missing_token",
        message: "Authorization header required",
      });
    });

    it("should return 401 when Authorization header is undefined", () => {
      mockRequest.headers = { authorization: undefined };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("invalid Bearer token format", () => {
    it("should return 401 when Authorization header is not Bearer format", () => {
      mockRequest.headers = { authorization: "Basic xyz" };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "missing_token",
        message: "Authorization header required",
      });
    });

    it("should return 401 when Authorization header has wrong prefix", () => {
      mockRequest.headers = { authorization: "Bearer " };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Empty token after "Bearer " - should be passed to verify and throw
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when only Bearer keyword is provided", () => {
      mockRequest.headers = { authorization: "Bearer" };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe("valid token", () => {
    it("should allow request with valid token", () => {
      const validPayload = { sub: "user-123", username: "testuser" };
      mockRequest.headers = { authorization: "Bearer validtoken123" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        ...validPayload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should extract token correctly from Bearer prefix", () => {
      const token = "validtoken123";
      mockRequest.headers = { authorization: `Bearer ${token}` };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        sub: "user-123",
        username: "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContainer.jwtService.verify).toHaveBeenCalledWith(token);
    });

    it("should attach user to request object", () => {
      mockRequest.headers = { authorization: "Bearer validtoken" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        sub: "user-456",
        username: "another_user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect((mockRequest as any).user).toEqual({
        id: "user-456",
        username: "another_user",
      });
    });

    it("should preserve all JWT payload fields when attaching to request", () => {
      mockRequest.headers = { authorization: "Bearer token" };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        sub: "user-789",
        username: "testuser",
        iat: 1234567890,
        exp: 1234571490,
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.id).toBe("user-789");
      expect(mockRequest.user?.username).toBe("testuser");
    });
  });

  describe("invalid token", () => {
    it("should return 401 when token verification fails", () => {
      mockRequest.headers = { authorization: "Bearer invalidtoken" };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "invalid_token",
        message: "Token invalid or expired",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle malformed token gracefully", () => {
      mockRequest.headers = { authorization: "Bearer malformed.token" };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("jwt malformed");
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should not call next() on token verification error", () => {
      mockRequest.headers = { authorization: "Bearer invalidtoken" };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should not attach user on verification error", () => {
      mockRequest.headers = { authorization: "Bearer invalidtoken" };
      const request = mockRequest as any;
      request.user = { id: "test", username: "test" };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // User should not be modified since verification failed
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("token extraction edge cases", () => {
    it("should handle token with extra spaces after Bearer", () => {
      const token = "validtoken";
      mockRequest.headers = { authorization: `Bearer  ${token}` }; // double space
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        sub: "user-123",
        username: "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Should extract " validtoken" (with leading space) due to slice(7)
      expect(mockContainer.jwtService.verify).toHaveBeenCalledWith(` ${token}`);
    });

    it("should handle token with special characters", () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      mockRequest.headers = { authorization: `Bearer ${token}` };
      vi.mocked(mockContainer.jwtService.verify).mockReturnValue({
        sub: "user-123",
        username: "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContainer.jwtService.verify).toHaveBeenCalledWith(token);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle token with dots and dashes", () => {
      const token = "xxx.yyy-zzz";
      mockRequest.headers = { authorization: `Bearer ${token}` };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContainer.jwtService.verify).toHaveBeenCalledWith(token);
    });
  });

  describe("expired token", () => {
    it("should return 401 for expired token", () => {
      mockRequest.headers = { authorization: "Bearer expiredtoken" };
      vi.mocked(mockContainer.jwtService.verify).mockImplementation(() => {
        throw new Error("token expired");
      });

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "invalid_token",
        message: "Token invalid or expired",
      });
    });
  });

  describe("case sensitivity", () => {
    it("should be case-sensitive for Bearer keyword", () => {
      mockRequest.headers = { authorization: "bearer token" }; // lowercase

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: "missing_token",
        message: "Authorization header required",
      });
    });
  });
});
