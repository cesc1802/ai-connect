import type { Request, Response, NextFunction } from "express";

// Headers the browser is allowed to send on a request (e.g. the login token).
const ALLOWED_HEADERS = "Content-Type, Authorization";
// HTTP methods the frontend is allowed to use against this server.
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

// Builds the CORS ("permission slip") middleware. `allowedOrigins` is the list
// of website addresses we trust (e.g. the Vite dev server at localhost:5173).
export function createCors(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);

  return function cors(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    // Only stamp the permission headers when the caller's address is trusted.
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      // Tells caches the response varies per Origin so they don't mix them up.
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    }

    // The browser's pre-check ("preflight") uses OPTIONS — answer it right away
    // with an empty 204 so the real request can follow.
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
