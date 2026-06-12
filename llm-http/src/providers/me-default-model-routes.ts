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
      // Mirrors the gateway's load rules: ollama is key-less and needs only
      // a base URL; every other kind needs a stored API key.
      const usable = providers.find(
        (p) =>
          p.isEnabled &&
          p.defaultModel &&
          (p.providerKind === "ollama" ? !!p.baseUrl : p.encryptedKey.length > 0)
      );
      res.json({ model: usable?.defaultModel ?? null });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
