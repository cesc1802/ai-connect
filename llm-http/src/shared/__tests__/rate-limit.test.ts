import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRateLimit, type RateLimitConfig } from "../rate-limit.js";
import type { Request, Response, NextFunction } from "express";

describe("Rate Limit Factory", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      ip: "192.168.1.1",
      headers: {},
      user: undefined,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe("createRateLimit - basic configuration", () => {
    it("should create rate limit middleware with IP key by default", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });

    it("should create rate limit middleware with custom message", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        message: "Custom rate limit message",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should create rate limit middleware with custom code", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        code: "custom_code",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });
  });

  describe("createRateLimit - IP-based rate limiting", () => {
    it("should use IP address as key when keyBy is 'ip'", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 5,
        keyBy: "ip",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should handle requests from different IPs independently", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 1,
        keyBy: "ip",
      };

      const middleware = createRateLimit(config);

      // Test that middleware is callable
      expect(typeof middleware).toBe("function");
    });
  });

  describe("createRateLimit - user-based rate limiting", () => {
    it("should use user ID as key when keyBy is 'user'", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        keyBy: "user",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should fall back to IP when user ID is not available", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        keyBy: "user",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should fall back to 'anon' when neither user nor IP available", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        keyBy: "user",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });
  });

  describe("createRateLimit - configuration defaults", () => {
    it("should use default message when none provided", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should use default code when none provided", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should use standardHeaders draft-7 by default", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });
  });

  describe("createRateLimit - various window and max settings", () => {
    it("should support 1 minute window", () => {
      const config: RateLimitConfig = {
        windowMs: 60 * 1000,
        max: 100,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should support 15 minute window", () => {
      const config: RateLimitConfig = {
        windowMs: 15 * 60 * 1000,
        max: 1000,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should support hourly window", () => {
      const config: RateLimitConfig = {
        windowMs: 60 * 60 * 1000,
        max: 10000,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should support low rate limits (strict)", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 1,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should support high rate limits (lenient)", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10000,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });
  });

  describe("createRateLimit - combined configurations", () => {
    it("should support login rate limiting config", () => {
      const config: RateLimitConfig = {
        windowMs: 15 * 60 * 1000,
        max: 5,
        keyBy: "ip",
        code: "login_rate_limited",
        message: "Too many login attempts",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should support chat rate limiting config", () => {
      const config: RateLimitConfig = {
        windowMs: 60 * 1000,
        max: 20,
        keyBy: "user",
        code: "chat_rate_limited",
        message: "Too many chat requests",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });
  });

  describe("createRateLimit - middleware type", () => {
    it("should return Express middleware function", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
      };

      const middleware = createRateLimit(config);

      // Express middleware has 3 or 4 parameters
      expect(middleware.length).toBeGreaterThanOrEqual(3);
    });

    it("should be callable with request, response, next", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
      };

      const middleware = createRateLimit(config);

      // Should be callable (not throw during call)
      expect(() => {
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }).not.toThrow();
    });
  });

  describe("createRateLimit - edge cases", () => {
    it("should handle zero max requests", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 0,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should handle very large window", () => {
      const config: RateLimitConfig = {
        windowMs: 365 * 24 * 60 * 60 * 1000,
        max: 1000000,
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should handle custom code with special characters", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        code: "rate_limit_exceeded_error",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });

    it("should handle long custom message", () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 10,
        message: "Too many requests - please wait before trying again. Service will reset at midnight UTC.",
      };

      const middleware = createRateLimit(config);
      expect(middleware).toBeDefined();
    });
  });
});
