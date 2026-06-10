import { Router } from "express";
import type { WorkspaceTemplatesRepository } from "./workspace-templates-repository.js";

/**
 * Top-level org library route: GET /prompt-templates
 * Any authenticated user can read the library (read-only catalog).
 * requireAuth must be applied at the mount site in app.ts.
 */
export function createPromptTemplatesRoutes(
  templatesRepo: WorkspaceTemplatesRepository
): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({ code: "missing_token", message: "Authorization header required" });
        return;
      }

      const templates = await templatesRepo.listLibrary();
      res.json({ templates });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
