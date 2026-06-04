import { Router } from "express";
import { z } from "zod";
import {
  EtagMismatchError,
  NotInOrgPoolError,
  type WsActor,
  type WsTemplatesService,
} from "./ws-templates-service.js";

const WorkspaceRoleEnum = z.enum(["owner", "admin", "member", "viewer"]);

const putBody = z.object({
  templates: z
    .array(
      z.object({
        templateId: z.string().min(1),
        suggestedRole: WorkspaceRoleEnum,
      }),
    )
    .max(100),
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

export function createWsTemplatesRoutes(service: WsTemplatesService): Router {
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
        parsed.data.templates,
        ifMatch,
      );
      res.setHeader("ETag", result.etag);
      res.json({ available: result.available, bound: result.bound });
    } catch (err) {
      if (err instanceof NotInOrgPoolError) {
        res.status(400).json({
          code: err.code,
          message: "One or more templates are not in the org pool",
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
