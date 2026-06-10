import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createCors } from "./cors-middleware.js";

// Builds a fake Response that records the headers/status the middleware sets.
function makeRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    status: vi.fn(() => res),
    end: vi.fn(),
  } as unknown as Response;
  return { res, headers };
}

describe("createCors", () => {
  it("stamps allow-origin headers for a trusted origin", () => {
    const cors = createCors(["http://localhost:5173"]);
    const req = { method: "POST", headers: { origin: "http://localhost:5173" } } as Request;
    const { res, headers } = makeRes();
    const next = vi.fn() as NextFunction;

    cors(req, res, next);

    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
    expect(next).toHaveBeenCalled();
  });

  it("answers a preflight OPTIONS request with 204 and no next()", () => {
    const cors = createCors(["http://localhost:5173"]);
    const req = { method: "OPTIONS", headers: { origin: "http://localhost:5173" } } as Request;
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;

    cors(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("does not stamp allow-origin for an untrusted origin", () => {
    const cors = createCors(["http://localhost:5173"]);
    const req = { method: "POST", headers: { origin: "http://evil.example" } } as Request;
    const { res, headers } = makeRes();
    const next = vi.fn() as NextFunction;

    cors(req, res, next);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
