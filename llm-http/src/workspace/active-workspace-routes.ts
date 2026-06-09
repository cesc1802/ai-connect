import { Router } from "express";
import type { ActiveWorkspaceResolver } from "./active-workspace-resolver.js";

export function createActiveWorkspaceRoutes(
  resolver: ActiveWorkspaceResolver
): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: "missing_token",
          message: "Authorization header required",
        });
        return;
      }

      const workspace = await resolver.getForUser(req.user.id);
      if (!workspace) {
        res.status(404).json({
          code: "no_active_workspace",
          message: "No active workspace",
        });
        return;
      }

      res.json({ workspace });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
