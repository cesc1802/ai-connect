import { Router } from "express";
import { z } from "zod";
import type { WsActor, WsQuotasService } from "./quotas-service.js";

const WorkspaceRoleEnum = z.enum(["owner", "admin", "member", "viewer"]);

const patchBody = z.object({
  rows: z
    .array(
      z.object({
        role: WorkspaceRoleEnum,
        maxRequests: z.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1)
    .max(20),
  force: z.boolean().optional(),
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

export function createWsQuotasRoutes(service: WsQuotasService): Router {
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
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/", async (req, res, next) => {
    try {
      const actor = requireActor(req);
      if (!actor) {
        res
          .status(401)
          .json({ code: "unauthenticated", message: "Unauthenticated" });
        return;
      }
      const parsed = patchBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: "Invalid request body",
          issues: parsed.error.issues,
        });
        return;
      }
      const result = await service.patch(
        actor,
        parsed.data.rows,
        parsed.data.force ?? false,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
