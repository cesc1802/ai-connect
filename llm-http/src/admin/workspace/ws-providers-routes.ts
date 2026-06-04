import { Router } from "express";
import { z } from "zod";
import {
  EtagMismatchError,
  NotInOrgPoolError,
  type WsActor,
  type WsProvidersService,
} from "./ws-providers-service.js";

const putBody = z.object({
  providerIds: z.array(z.string().min(1)).max(100),
});

function requireActor(req: {
  user?: { id: string; org: string; workspace: string | null };
}): WsActor | null {
  if (!req.user || !req.user.workspace) return null;
  return {
    userId: req.user.id,
    orgId: req.user.org,
    workspaceId: req.user.workspace,
  };
}

export function createWsProvidersRoutes(service: WsProvidersService): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res
          .status(401)
          .json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const result = await service.list(actor);
      res.setHeader("ETag", result.etag);
      res.json({ available: result.available, bound: result.bound });
    } catch (err) {
      next(err);
    }
  });

  router.put("/", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res
          .status(401)
          .json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const parsed = putBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: "Invalid request body",
          issues: parsed.error.issues,
        });
        return;
      }
      const rawIfMatch = req.header("if-match");
      const ifMatch =
        typeof rawIfMatch === "string" && rawIfMatch.length > 0
          ? rawIfMatch.replace(/^"|"$/g, "")
          : null;
      const result = await service.replace(
        actor,
        parsed.data.providerIds,
        ifMatch,
      );
      res.setHeader("ETag", result.etag);
      res.json({ available: result.available, bound: result.bound });
    } catch (err) {
      if (err instanceof NotInOrgPoolError) {
        res.status(400).json({
          code: err.code,
          message: "One or more providers are not in the org pool",
          invalidIds: err.invalidIds,
        });
        return;
      }
      if (err instanceof EtagMismatchError) {
        res.status(409).json({ code: err.code, message: err.message });
        return;
      }
      next(err);
    }
  });

  return router;
}
