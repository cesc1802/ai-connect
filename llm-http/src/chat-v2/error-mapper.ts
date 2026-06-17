const ERROR_CODE_MAP: Record<string, string> = {
  AuthenticationError: "provider_auth_error",
  RateLimitError: "provider_rate_limit",
  TimeoutError: "provider_timeout",
  CircuitOpenError: "provider_unavailable",
  FallbackExhaustedError: "all_providers_failed",
  ValidationError: "invalid_request",
  ModelNotFoundError: "model_not_found",
  ContentFilterError: "content_filtered",
  AbortError: "request_cancelled",
  // Keyed on the error's `name` (not its `code`). The gateway guarantees
  // GuardrailBlockedError.message is static and content-free, so returning it
  // verbatim via sanitizeErrorMessage never leaks the matched secret/PII.
  GuardrailBlockedError: "guardrail_blocked",
};

export function mapErrorToCode(err: Error): string {
  return ERROR_CODE_MAP[err.name] ?? "internal_error";
}

export function sanitizeErrorMessage(err: Error): string {
  const code = mapErrorToCode(err);
  if (code === "internal_error") {
    return "An unexpected error occurred";
  }
  return err.message;
}
