/**
 * Base error for all LLM Gateway errors
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "LLMError";
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause?.message,
    };
  }
}

/**
 * Provider-specific errors
 */
export class ProviderError extends LLMError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, "PROVIDER_ERROR", cause);
    this.name = "ProviderError";
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends ProviderError {
  override readonly code = "RATE_LIMIT";

  constructor(
    provider: string,
    public readonly retryAfterMs?: number,
    cause?: Error
  ) {
    super(`Rate limit exceeded for ${provider}`, provider, 429, cause);
    this.name = "RateLimitError";
  }
}

/**
 * Authentication failed
 */
export class AuthenticationError extends ProviderError {
  override readonly code = "AUTH_ERROR";

  constructor(provider: string, cause?: Error) {
    super(`Authentication failed for ${provider}`, provider, 401, cause);
    this.name = "AuthenticationError";
  }
}

/**
 * Invalid request (bad params, unsupported model)
 */
export class ValidationError extends LLMError {
  constructor(
    message: string,
    public readonly field?: string,
    cause?: Error
  ) {
    super(message, "VALIDATION_ERROR", cause);
    this.name = "ValidationError";
  }
}

/**
 * Request timeout
 */
export class TimeoutError extends LLMError {
  constructor(
    public readonly provider: string,
    public readonly timeoutMs: number,
    cause?: Error
  ) {
    super(`Request to ${provider} timed out after ${timeoutMs}ms`, "TIMEOUT", cause);
    this.name = "TimeoutError";
  }
}

/**
 * Circuit breaker open
 */
export class CircuitOpenError extends LLMError {
  constructor(
    public readonly provider: string,
    public readonly opensAt: Date,
    cause?: Error
  ) {
    super(`Circuit breaker open for ${provider}`, "CIRCUIT_OPEN", cause);
    this.name = "CircuitOpenError";
  }
}

/**
 * All fallback providers failed
 */
export class FallbackExhaustedError extends LLMError {
  constructor(
    public readonly errors: Error[],
    cause?: Error
  ) {
    super(`All fallback providers failed`, "FALLBACK_EXHAUSTED", cause);
    this.name = "FallbackExhaustedError";
  }
}

/**
 * Model not found or not available
 */
export class ModelNotFoundError extends ProviderError {
  override readonly code = "MODEL_NOT_FOUND";

  constructor(
    provider: string,
    public readonly model: string,
    cause?: Error
  ) {
    super(`Model ${model} not found for ${provider}`, provider, 404, cause);
    this.name = "ModelNotFoundError";
  }
}

/**
 * Content filtered by provider safety
 */
export class ContentFilterError extends ProviderError {
  override readonly code = "CONTENT_FILTERED";

  constructor(provider: string, cause?: Error) {
    super(`Content filtered by ${provider} safety system`, provider, 400, cause);
    this.name = "ContentFilterError";
  }
}

/**
 * Request was aborted via AbortSignal
 */
export class AbortError extends LLMError {
  constructor(cause?: Error) {
    super("Request was aborted", "ABORTED", cause);
    this.name = "AbortError";
  }
}
