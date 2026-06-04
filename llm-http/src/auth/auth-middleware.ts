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
      req.user = {
        id: payload.sub,
        username: payload.username,
        org: payload.org,
        orgRole: payload.orgRole,
        workspace: payload.workspace,
        workspaceRole: payload.workspaceRole,
      };
      next();
    } catch {
      res.status(401).json({
        code: "invalid_token",
        message: "Token invalid or expired",
      });
    }
  };
}

export function createRequireOrgAdmin(): RequestHandler {
  return (req, res, next) => {
    if (req.user?.orgRole !== "admin") {
      res.status(403).json({
        code: "role_required",
        message: "Forbidden",
      });
      return;
    }
    next();
  };
}

export function createRequireWorkspaceAdmin(): RequestHandler {
  return (req, res, next) => {
    const role = req.user?.workspaceRole;
    if (role !== "owner" && role !== "admin") {
      res.status(403).json({
        code: "role_required",
        message: "Forbidden",
      });
      return;
    }
    next();
  };
}
