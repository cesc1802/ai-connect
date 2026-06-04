import type { RequestHandler } from "express";

const REDACTED = "[REDACTED]";

// Field names to redact when serializing request/response bodies for logging.
// Case-insensitive match — any nested key with this name is rewritten before logging.
const SENSITIVE_KEYS = new Set([
  "apikey",
  "key",
  "secret",
  "authorization",
  "cookie",
  "password",
  "token",
]);

export function scrubSensitive(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrubSensitive);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = scrubSensitive(v);
    }
  }
  return out;
}

declare global {
  namespace Express {
    interface Request {
      scrubbedBody?: unknown;
    }
  }
}

// Middleware: adds `req.scrubbedBody` derived from `req.body` so any downstream
// request logger consumes the redacted view, never the raw secret-bearing body.
export function createRedactLogMiddleware(): RequestHandler {
  return (req, _res, next) => {
    if (req.body !== undefined) {
      req.scrubbedBody = scrubSensitive(req.body);
    }
    next();
  };
}
