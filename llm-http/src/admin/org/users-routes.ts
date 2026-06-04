import { Router } from "express";
import { z } from "zod";
import type { AppContainer } from "../../container.js";
import {
  DuplicatePendingError,
  UserNotFoundError,
} from "./users-service.js";

const inviteBodySchema = z.object({
  email: z.string().email(),
});

export function createOrgUsersRoutes(container: AppContainer): Router {
  const router = Router();
  const service = container.orgUsersService;

  router.get("/", async (req, res, next) => {
    try {
      const orgId = req.user!.org;
      const users = await service.list(orgId);
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  router.post("/invite", async (req, res, next) => {
    try {
      const parsed = inviteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const orgId = req.user!.org;
      const actorId = req.user!.id;
      try {
        const row = await service.invite(orgId, actorId, parsed.data.email);
        res.status(201).json(row);
      } catch (err) {
        if (err instanceof DuplicatePendingError) {
          res.status(409).json({
            code: "duplicate_pending",
            message: "Pending invite already exists for this email",
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/disable", async (req, res, next) => {
    try {
      const orgId = req.user!.org;
      const actorId = req.user!.id;
      const { id } = req.params;
      try {
        const row = await service.disable(orgId, actorId, id);
        res.json(row);
      } catch (err) {
        if (err instanceof UserNotFoundError) {
          res.status(404).json({
            code: "user_not_found",
            message: "User not found",
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
