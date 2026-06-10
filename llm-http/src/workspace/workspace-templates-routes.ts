import { Router } from "express";
import { z } from "zod";
import {
  TemplateAlreadyAttachedError,
  type WorkspaceTemplatesRepository,
} from "./workspace-templates-repository.js";
import type { WorkspaceRepository } from "./workspace-repository.js";

const idSchema = z.string().uuid();

const attachBodySchema = z.object({
  templateId: z.string().uuid("templateId must be a valid UUID"),
});

function notFoundWorkspace(res: Parameters<typeof res401>[0]) {
  res.status(404).json({ code: "workspace_not_found", message: "Workspace not found" });
}

function res401(res: { status: (c: number) => { json: (b: unknown) => unknown } }) {
  res.status(401).json({ code: "missing_token", message: "Authorization header required" });
}

function res403(res: Parameters<typeof res401>[0]) {
  res.status(403).json({ code: "role_required", message: "Forbidden" });
}

/**
 * Nested routes for /workspaces/:id/templates.
 * requireAuth must be applied at the mount site.
 */
export function createWorkspaceTemplatesRoutes(
  templatesRepo: WorkspaceTemplatesRepository,
  workspaceRepo: WorkspaceRepository
): Router {
  const router = Router({ mergeParams: true });

  // GET /workspaces/:id/templates — admin any; member own-ws only
  router.get("/", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      if (req.user.role !== "admin") {
        const member = await workspaceRepo.isMember(req.user.id, wsId);
        if (!member) { notFoundWorkspace(res); return; }
      }

      const templates = await templatesRepo.listForWorkspace(wsId);
      res.json({ templates });
    } catch (err) {
      next(err);
    }
  });

  // POST /workspaces/:id/templates — admin-only; attach template
  router.post("/", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const parsedBody = attachBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const { templateId } = parsedBody.data;

      const exists = await templatesRepo.templateExists(templateId);
      if (!exists) {
        res.status(404).json({ code: "template_not_found", message: "Template not found" });
        return;
      }

      await templatesRepo.attach(wsId, templateId);
      res.status(201).json({ templateId });
    } catch (err) {
      if (err instanceof TemplateAlreadyAttachedError) {
        res.status(409).json({ code: "template_attached", message: "Template already attached" });
        return;
      }
      next(err);
    }
  });

  // DELETE /workspaces/:id/templates/:templateId — admin-only; detach
  router.delete("/:templateId", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const parsedTemplateId = idSchema.safeParse((req.params as Record<string, string>).templateId);
      if (!parsedTemplateId.success) {
        res.status(404).json({ code: "template_not_found", message: "Template not found" });
        return;
      }
      const templateId = parsedTemplateId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const detached = await templatesRepo.detach(wsId, templateId);
      if (!detached) {
        res.status(404).json({ code: "template_not_found", message: "Template not attached" });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
