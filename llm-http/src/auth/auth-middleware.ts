import type { RequestHandler } from "express";
import type { AppContainer } from "../container.js";

export function createRequireAuth(container: AppContainer): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({
        code: "missing_token",
        message: "Authorization header required",
      });
      return;
    }

    try {
      const token = header.slice(7);
      const payload = container.jwtService.verify(token);
      req.user = { id: payload.sub, username: payload.username };
      next();
    } catch {
      res.status(401).json({
        code: "invalid_token",
        message: "Token invalid or expired",
      });
    }
  };
}
