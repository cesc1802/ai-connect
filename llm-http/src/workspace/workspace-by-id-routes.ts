import { Router } from "express";
import { z } from "zod";
import {
  SlugTakenError,
  type WorkspaceRepository,
} from "./workspace-repository.js";

// Non-UUID ids short-circuit to 404 before hitting Postgres, which would
// otherwise raise a 22P02 (invalid uuid input) instead of a clean miss.
const idSchema = z.string().uuid();

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase alphanumerics separated by hyphens")
      .max(50)
      .optional(),
  })
  .refine((body) => body.name !== undefined || body.slug !== undefined, {
    message: "At least one of name or slug is required",
  });

function notFound(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  res.status(404).json({
    code: "workspace_not_found",
    message: "Workspace not found",
  });
}

/**
 * Routes for a single workspace: GET /:id (admin: any; member: only
 * workspaces they belong to — non-membership reads as 404 so foreign
 * workspace ids don't leak existence), PATCH /:id and DELETE /:id
 * (admin-only; delete is a soft delete via deletedAt).
 */
export function createWorkspaceByIdRoutes(repo: WorkspaceRepository): Router {
  const router = Router();

  router.get("/:id", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: "missing_token",
          message: "Authorization header required",
        });
        return;
      }

      const parsedId = idSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        notFound(res);
        return;
      }

      const workspace = await repo.getById(parsedId.data);
      if (!workspace) {
        notFound(res);
        return;
      }

      if (req.user.role !== "admin") {
        const member = await repo.isMember(req.user.id, workspace.id);
        if (!member) {
          notFound(res);
          return;
        }
      }

      res.json(workspace);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: "missing_token",
          message: "Authorization header required",
        });
        return;
      }

      if (req.user.role !== "admin") {
        res.status(403).json({
          code: "role_required",
          message: "Forbidden",
        });
        return;
      }

      const parsedId = idSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        notFound(res);
        return;
      }

      const parsedBody = patchBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      // Drop undefined keys so the patch satisfies exactOptionalPropertyTypes
      // and the SQL SET clause only touches the fields the caller sent.
      const { name, slug } = parsedBody.data;
      const patch = {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
      };

      const updated = await repo.update(parsedId.data, patch);
      if (!updated) {
        notFound(res);
        return;
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof SlugTakenError) {
        res.status(409).json({
          code: "slug_taken",
          message: "Workspace slug is already taken",
        });
        return;
      }
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({
          code: "missing_token",
          message: "Authorization header required",
        });
        return;
      }

      if (req.user.role !== "admin") {
        res.status(403).json({
          code: "role_required",
          message: "Forbidden",
        });
        return;
      }

      const parsedId = idSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        notFound(res);
        return;
      }

      const deleted = await repo.softDelete(parsedId.data);
      if (!deleted) {
        notFound(res);
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
