import { describe, it, expect } from "vitest";
import { mapErrorToCode } from "../error-mapper.js";

describe("mapErrorToCode", () => {
  describe("authentication errors", () => {
    it("should map AuthenticationError to provider_auth_error", () => {
      const err = new Error("Auth failed");
      err.name = "AuthenticationError";
      expect(mapErrorToCode(err)).toBe("provider_auth_error");
    });

    it("should handle AuthenticationError with custom message", () => {
      const err = new Error("Invalid API key");
      err.name = "AuthenticationError";
      expect(mapErrorToCode(err)).toBe("provider_auth_error");
    });
  });

  describe("rate limit errors", () => {
    it("should map RateLimitError to provider_rate_limit", () => {
      const err = new Error("Rate limit exceeded");
      err.name = "RateLimitError";
      expect(mapErrorToCode(err)).toBe("provider_rate_limit");
    });

    it("should handle RateLimitError with retry info", () => {
      const err = new Error("Too many requests. Retry after 60 seconds");
      err.name = "RateLimitError";
      expect(mapErrorToCode(err)).toBe("provider_rate_limit");
    });
  });

  describe("timeout errors", () => {
    it("should map TimeoutError to provider_timeout", () => {
      const err = new Error("Request timeout");
      err.name = "TimeoutError";
      expect(mapErrorToCode(err)).toBe("provider_timeout");
    });

    it("should handle TimeoutError with duration", () => {
      const err = new Error("Timeout after 30000ms");
      err.name = "TimeoutError";
      expect(mapErrorToCode(err)).toBe("provider_timeout");
    });
  });

  describe("circuit breaker errors", () => {
    it("should map CircuitOpenError to provider_unavailable", () => {
      const err = new Error("Circuit breaker is open");
      err.name = "CircuitOpenError";
      expect(mapErrorToCode(err)).toBe("provider_unavailable");
    });

    it("should handle CircuitOpenError due to failures", () => {
      const err = new Error("Too many failures, circuit opened");
      err.name = "CircuitOpenError";
      expect(mapErrorToCode(err)).toBe("provider_unavailable");
    });
  });

  describe("fallback exhausted errors", () => {
    it("should map FallbackExhaustedError to all_providers_failed", () => {
      const err = new Error("All fallback providers exhausted");
      err.name = "FallbackExhaustedError";
      expect(mapErrorToCode(err)).toBe("all_providers_failed");
    });

    it("should handle FallbackExhaustedError with provider details", () => {
      const err = new Error("All providers failed: gpt-4, gpt-3.5-turbo");
      err.name = "FallbackExhaustedError";
      expect(mapErrorToCode(err)).toBe("all_providers_failed");
    });
  });

  describe("unknown/default errors", () => {
    it("should map unknown error types to internal_error", () => {
      const err = new Error("Something went wrong");
      err.name = "UnknownError";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should map generic Error to internal_error", () => {
      const err = new Error("Generic error");
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should map SyntaxError to internal_error", () => {
      const err = new SyntaxError("Invalid JSON");
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should map TypeError to internal_error", () => {
      const err = new TypeError("Cannot read property");
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should handle null name gracefully", () => {
      const err = new Error("Test error");
      err.name = "";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });
  });

  describe("error name case sensitivity", () => {
    it("should require exact case match for AuthenticationError", () => {
      const err = new Error("Auth failed");
      err.name = "authenticationerror";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should require exact case match for RateLimitError", () => {
      const err = new Error("Rate limit");
      err.name = "ratelimiterror";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should require exact case match for TimeoutError", () => {
      const err = new Error("Timeout");
      err.name = "timeouterror";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should require exact case match for CircuitOpenError", () => {
      const err = new Error("Circuit open");
      err.name = "circuitopenerror";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });

    it("should require exact case match for FallbackExhaustedError", () => {
      const err = new Error("Fallback exhausted");
      err.name = "fallbackexhausterror";
      expect(mapErrorToCode(err)).toBe("internal_error");
    });
  });

  describe("custom error objects", () => {
    class CustomAuthError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "AuthenticationError";
      }
    }

    it("should map custom error extending Error", () => {
      const err = new CustomAuthError("Custom auth error");
      expect(mapErrorToCode(err)).toBe("provider_auth_error");
    });

    it("should handle error with complex message", () => {
      const err = new Error("Provider request failed: 401 Unauthorized");
      err.name = "AuthenticationError";
      expect(mapErrorToCode(err)).toBe("provider_auth_error");
    });

    it("should handle error with multiline message", () => {
      const err = new Error("Error details:\n- Provider: OpenAI\n- Status: 429");
      err.name = "RateLimitError";
      expect(mapErrorToCode(err)).toBe("provider_rate_limit");
    });
  });

  describe("error mapping consistency", () => {
    it("should always return the same code for same error name", () => {
      const err1 = new Error("Error 1");
      err1.name = "AuthenticationError";
      const err2 = new Error("Error 2");
      err2.name = "AuthenticationError";
      expect(mapErrorToCode(err1)).toBe(mapErrorToCode(err2));
    });

    it("should map all defined error types without throwing", () => {
      const errorNames = [
        "AuthenticationError",
        "RateLimitError",
        "TimeoutError",
        "CircuitOpenError",
        "FallbackExhaustedError",
      ];

      errorNames.forEach((name) => {
        const err = new Error("Test");
        err.name = name;
        expect(() => mapErrorToCode(err)).not.toThrow();
        expect(mapErrorToCode(err)).toBeDefined();
        expect(typeof mapErrorToCode(err)).toBe("string");
      });
    });
  });
});
