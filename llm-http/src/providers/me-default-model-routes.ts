import { Router } from "express";
import type { ProvidersRepository } from "./providers-repository.js";

// Member-safe lookup of the org's default chat model. Unlike /providers
// (org-admin only), this exposes nothing about the provider besides the
// model id, so any authenticated member may call it.
export function createMeDefaultModelRoutes(repo: ProvidersRepository): Router {
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

      const providers = await repo.listByOrg(req.user.org);
      const usable = providers.find(
        (p) => p.isEnabled && p.encryptedKey.length > 0 && p.defaultModel
      );
      res.json({ model: usable?.defaultModel ?? null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
