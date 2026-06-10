import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  TemplateInUseError,
  type WorkspaceTemplatesRepository,
} from "./workspace-templates-repository.js";

const idSchema = z.string().uuid();

// Blank bodies persist as null so "no prompt content" has a single
// representation (consumers fall back on description when body is null).
const promptBodySchema = z
  .string()
  .max(8000)
  .transform((v) => (v.trim() === "" ? null : v));

const createBodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(280),
  body: promptBodySchema.optional(),
});

const updateBodySchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    icon: z.string().trim().min(1).max(40).optional(),
    description: z.string().trim().min(1).max(280).optional(),
    body: promptBodySchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to update",
  });

function res401(res: Response) {
  res.status(401).json({ code: "missing_token", message: "Authorization header required" });
}

function res403(res: Response) {
  res.status(403).json({ code: "role_required", message: "Forbidden" });
}

function notFoundTemplate(res: Response) {
  res.status(404).json({ code: "not_found", message: "Template not found" });
}

function invalidInput(res: Response, issues: z.ZodIssue[]) {
  res.status(400).json({ code: "invalid_input", message: "Invalid template payload", issues });
}

/** Authenticated admin or null (response already written). */
function requireAdmin(req: Request, res: Response) {
  if (!req.user) {
    res401(res);
    return null;
  }
  if (req.user.role !== "admin") {
    res403(res);
    return null;
  }
  return req.user;
}

/**
 * Org prompt-template library at /prompt-templates.
 * Read is open to any authenticated user; create/update/delete are admin-only.
 * requireAuth must be applied at the mount site in app.ts.
 */
export function createPromptTemplatesRoutes(
  templatesRepo: WorkspaceTemplatesRepository
): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }

      const templates = await templatesRepo.listLibrary();
      res.json({ templates });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const user = requireAdmin(req, res);
      if (!user) return;

      const parsed = createBodySchema.safeParse(req.body);
      if (!parsed.success) { invalidInput(res, parsed.error.issues); return; }

      const template = await templatesRepo.createTemplate({
        ...parsed.data,
        slug: `tpl-${randomUUID()}`,
        authorName: user.username,
        body: parsed.data.body ?? null,
      });
      res.status(201).json({ template });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const user = requireAdmin(req, res);
      if (!user) return;

      const parsedId = idSchema.safeParse(req.params.id);
      if (!parsedId.success) { notFoundTemplate(res); return; }

      const parsed = updateBodySchema.safeParse(req.body);
      if (!parsed.success) { invalidInput(res, parsed.error.issues); return; }

      const template = await templatesRepo.updateTemplate(parsedId.data, parsed.data);
      if (!template) { notFoundTemplate(res); return; }
      res.json({ template });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const user = requireAdmin(req, res);
      if (!user) return;

      const parsedId = idSchema.safeParse(req.params.id);
      if (!parsedId.success) { notFoundTemplate(res); return; }

      const deleted = await templatesRepo.deleteTemplate(parsedId.data);
      if (!deleted) { notFoundTemplate(res); return; }
      res.status(204).send();
    } catch (err) {
      if (err instanceof TemplateInUseError) {
        res.status(409).json({
          code: "template_in_use",
          message: "Template is attached to one or more workspaces",
        });
        return;
      }
      next(err);
    }
  });

  return router;
}
