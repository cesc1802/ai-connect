import { describe, it, expect } from "vitest";
import {
  LLMError,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  ValidationError,
  TimeoutError,
  CircuitOpenError,
  FallbackExhaustedError,
  ModelNotFoundError,
  ContentFilterError,
  AbortError,
} from "../errors.js";

describe("LLMError", () => {
  it("should create error with code and message", () => {
    const error = new LLMError("Test error", "TEST_CODE");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("LLMError");
  });

  it("should serialize to JSON correctly", () => {
    const cause = new Error("Root cause");
    const error = new LLMError("Test error", "TEST_CODE", cause);
    const json = error.toJSON();

    expect(json).toEqual({
      name: "LLMError",
      code: "TEST_CODE",
      message: "Test error",
      cause: "Root cause",
    });
  });

  it("should serialize without cause", () => {
    const error = new LLMError("Test error", "TEST_CODE");
    const json = error.toJSON();

    expect(json.cause).toBeUndefined();
  });
});

describe("ProviderError", () => {
  it("should include provider and status code", () => {
    const error = new ProviderError("Provider failed", "anthropic", 500);
    expect(error.provider).toBe("anthropic");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("PROVIDER_ERROR");
  });
});

describe("RateLimitError", () => {
  it("should have correct defaults", () => {
    const error = new RateLimitError("openai", 5000);
    expect(error.message).toBe("Rate limit exceeded for openai");
    expect(error.provider).toBe("openai");
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("RATE_LIMIT");
    expect(error.retryAfterMs).toBe(5000);
  });
});

describe("AuthenticationError", () => {
  it("should have correct defaults", () => {
    const error = new AuthenticationError("anthropic");
    expect(error.message).toBe("Authentication failed for anthropic");
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("AUTH_ERROR");
  });
});

describe("ValidationError", () => {
  it("should include field information", () => {
    const error = new ValidationError("Invalid model", "model");
    expect(error.message).toBe("Invalid model");
    expect(error.field).toBe("model");
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});

describe("TimeoutError", () => {
  it("should include timeout details", () => {
    const error = new TimeoutError("openai", 30000);
    expect(error.message).toBe("Request to openai timed out after 30000ms");
    expect(error.provider).toBe("openai");
    expect(error.timeoutMs).toBe(30000);
    expect(error.code).toBe("TIMEOUT");
  });
});

describe("CircuitOpenError", () => {
  it("should include circuit state", () => {
    const opensAt = new Date();
    const error = new CircuitOpenError("anthropic", opensAt);
    expect(error.message).toBe("Circuit breaker open for anthropic");
    expect(error.provider).toBe("anthropic");
    expect(error.opensAt).toBe(opensAt);
    expect(error.code).toBe("CIRCUIT_OPEN");
  });
});

describe("FallbackExhaustedError", () => {
  it("should collect all errors", () => {
    const errors = [new Error("First"), new Error("Second")];
    const error = new FallbackExhaustedError(errors);
    expect(error.message).toBe("All fallback providers failed");
    expect(error.errors).toEqual(errors);
    expect(error.code).toBe("FALLBACK_EXHAUSTED");
  });
});

describe("ModelNotFoundError", () => {
  it("should include model name", () => {
    const error = new ModelNotFoundError("openai", "gpt-5");
    expect(error.message).toBe("Model gpt-5 not found for openai");
    expect(error.model).toBe("gpt-5");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("MODEL_NOT_FOUND");
  });
});

describe("ContentFilterError", () => {
  it("should have correct defaults", () => {
    const error = new ContentFilterError("anthropic");
    expect(error.message).toBe("Content filtered by anthropic safety system");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("CONTENT_FILTERED");
  });
});

describe("AbortError", () => {
  it("should have correct defaults", () => {
    const error = new AbortError();
    expect(error.message).toBe("Request was aborted");
    expect(error.code).toBe("ABORTED");
  });
});
