import type { RequestHandler } from "express";
import type { AppContainer } from "../container.js";

export function createRequireAuth(container: AppContainer): RequestHandler {
  return async (req, res, next) => {
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
      const record = await container.userRepository.findByUsername(payload.username);
      if (!record) {
        res.status(401).json({
          code: "invalid_token",
          message: "Token invalid or expired",
        });
        return;
      }
      // org/orgRole/workspace/workspaceRole are transitional shims for the admin
      // routes pending their decommission; identity now comes from the slim JWT
      // and the user record's system role. The system role mirrors onto both
      // orgRole and workspaceRole so a system admin keeps reaching those routes
      // (a system member maps to null → 403), preserving pre-existing access.
      req.user = {
        id: payload.sub,
        username: payload.username,
        role: record.role,
        org: "default",
        orgRole: record.role,
        workspace: null,
        workspaceRole: record.role === "admin" ? "admin" : null,
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
