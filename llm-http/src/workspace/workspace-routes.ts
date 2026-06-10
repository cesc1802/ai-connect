import { Router } from "express";
import { z } from "zod";
import { createWorkspaceByIdRoutes } from "./workspace-by-id-routes.js";
import {
  SlugTakenError,
  type WorkspaceRepository,
} from "./workspace-repository.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase alphanumerics separated by hyphens")
    .max(50)
    .optional(),
});

/**
 * Derives a URL-safe slug from a workspace name (lowercase, hyphen-separated),
 * truncated to the same 50-char limit enforced on explicit slugs.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

export function createWorkspaceRoutes(repo: WorkspaceRepository): Router {
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

      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid query parameters",
        });
        return;
      }

      const { page, limit } = parsed.data;
      const opts = { limit, offset: (page - 1) * limit };
      const { items, total } =
        req.user.role === "admin"
          ? await repo.listAll(opts)
          : await repo.listForUser(req.user.id, opts);

      res.json({ items, page, limit, total });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
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

      const parsed = createBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const { name } = parsed.data;
      const slug = parsed.data.slug ?? slugify(name);
      if (!slug) {
        res.status(400).json({
          code: "invalid_body",
          message: "Name must contain at least one alphanumeric character",
        });
        return;
      }

      const workspace = await repo.create({ slug, name });
      res.status(201).json(workspace);
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

  router.use(createWorkspaceByIdRoutes(repo));

  return router;
}
