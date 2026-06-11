import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  createRedactLogMiddleware,
  scrubSensitive,
} from "./redact-log-middleware.js";

describe("scrubSensitive", () => {
  it("redacts top-level apiKey value", () => {
    const scrubbed = scrubSensitive({ apiKey: "sk-secret", name: "OpenAI" });
    expect(scrubbed).toEqual({ apiKey: "[REDACTED]", name: "OpenAI" });
  });

  it("redacts nested apiKey deep in object graph", () => {
    const scrubbed = scrubSensitive({
      provider: { apiKey: "sk-x", meta: { secret: "shh" } },
      others: [{ key: "x", safe: 1 }],
    });
    expect(scrubbed).toEqual({
      provider: { apiKey: "[REDACTED]", meta: { secret: "[REDACTED]" } },
      others: [{ key: "[REDACTED]", safe: 1 }],
    });
  });

  it("redacts sensitive keys regardless of casing", () => {
    const scrubbed = scrubSensitive({
      Authorization: "Bearer abc",
      Cookie: "sid=1",
      APIKEY: "sk-y",
    });
    expect(scrubbed).toEqual({
      Authorization: "[REDACTED]",
      Cookie: "[REDACTED]",
      APIKEY: "[REDACTED]",
    });
  });

  it("preserves non-sensitive primitives and structure", () => {
    expect(scrubSensitive("hello")).toBe("hello");
    expect(scrubSensitive(42)).toBe(42);
    expect(scrubSensitive(null)).toBe(null);
    expect(scrubSensitive([1, "two", { a: 3 }])).toEqual([
      1,
      "two",
      { a: 3 },
    ]);
  });

  it("never includes the raw secret value when serialized", () => {
    const scrubbed = scrubSensitive({
      provider: { apiKey: "sk-must-not-leak" },
    });
    expect(JSON.stringify(scrubbed)).not.toContain("sk-must-not-leak");
    expect(JSON.stringify(scrubbed)).toContain("[REDACTED]");
  });
});

describe("createRedactLogMiddleware", () => {
  it("sets req.scrubbedBody with sensitive keys redacted", () => {
    const middleware = createRedactLogMiddleware();
    const req = {
      body: { displayName: "OpenAI", apiKey: "sk-secret" },
    } as Partial<Request> as Request;
    const next = vi.fn() as NextFunction;

    middleware(req, {} as Response, next);

    expect(req.scrubbedBody).toEqual({
      displayName: "OpenAI",
      apiKey: "[REDACTED]",
    });
    expect(JSON.stringify(req.scrubbedBody)).not.toContain("sk-secret");
    expect(next).toHaveBeenCalled();
  });

  it("does not mutate the original req.body", () => {
    const middleware = createRedactLogMiddleware();
    const body = { apiKey: "sk-secret" };
    const req = { body } as Partial<Request> as Request;
    middleware(req, {} as Response, vi.fn() as NextFunction);

    expect(req.body).toBe(body);
    expect((req.body as { apiKey: string }).apiKey).toBe("sk-secret");
  });

  it("is a no-op when req.body is undefined", () => {
    const middleware = createRedactLogMiddleware();
    const req = {} as Request;
    const next = vi.fn() as NextFunction;
    middleware(req, {} as Response, next);
    expect(req.scrubbedBody).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
