import { Router } from "express";
import { z } from "zod";
import type { AppContainer } from "../../container.js";
import {
  DuplicateMemberError,
  LAST_ADMIN_CODE,
  LastAdminError,
  MemberNotFoundError,
} from "./members-service.js";

const WorkspaceRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

const inviteBodySchema = z.object({
  email: z.string().email(),
  role: WorkspaceRoleSchema,
});

const changeRoleBodySchema = z.object({
  role: WorkspaceRoleSchema,
});

export function createWsMembersRoutes(container: AppContainer): Router {
  const router = Router();
  const service = container.wsMembersService;

  router.get("/", async (req, res, next) => {
    try {
      const wsId = req.user?.workspace;
      if (!wsId) {
        res.status(403).json({
          code: "no_workspace",
          message: "Active workspace required",
        });
        return;
      }
      const members = await service.list(wsId);
      res.json({ members });
    } catch (err) {
      next(err);
    }
  });

  router.post("/invite", async (req, res, next) => {
    try {
      const wsId = req.user?.workspace;
      if (!wsId) {
        res.status(403).json({
          code: "no_workspace",
          message: "Active workspace required",
        });
        return;
      }
      const parsed = inviteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }
      const actorId = req.user!.id;
      try {
        const row = await service.invite(wsId, actorId, parsed.data);
        res.status(201).json(row);
      } catch (err) {
        if (err instanceof DuplicateMemberError) {
          res.status(409).json({
            code: "duplicate_member",
            message: "A member with this email already exists",
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const wsId = req.user?.workspace;
      if (!wsId) {
        res.status(403).json({
          code: "no_workspace",
          message: "Active workspace required",
        });
        return;
      }
      const parsed = changeRoleBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }
      const actorId = req.user!.id;
      const { id } = req.params;
      try {
        const row = await service.changeRole(
          wsId,
          actorId,
          id,
          parsed.data.role,
        );
        res.json(row);
      } catch (err) {
        if (err instanceof MemberNotFoundError) {
          res.status(404).json({
            code: "member_not_found",
            message: "Member not found",
          });
          return;
        }
        if (err instanceof LastAdminError) {
          res.status(422).json({
            error: "unprocessable_entity",
            code: LAST_ADMIN_CODE,
            message: "Workspace must retain at least one admin",
          });
          return;
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const wsId = req.user?.workspace;
      if (!wsId) {
        res.status(403).json({
          code: "no_workspace",
          message: "Active workspace required",
        });
        return;
      }
      const actorId = req.user!.id;
      const { id } = req.params;
      try {
        const row = await service.remove(wsId, actorId, id);
        res.json(row);
      } catch (err) {
        if (err instanceof MemberNotFoundError) {
          res.status(404).json({
            code: "member_not_found",
            message: "Member not found",
          });
          return;
        }
        if (err instanceof LastAdminError) {
          res.status(422).json({
            error: "unprocessable_entity",
            code: LAST_ADMIN_CODE,
            message: "Workspace must retain at least one admin",
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
