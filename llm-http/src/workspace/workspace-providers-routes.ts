import { Router } from "express";
import { z } from "zod";
import type { WorkspaceProvidersRepository } from "./workspace-providers-repository.js";
import type { WorkspaceRepository } from "./workspace-repository.js";

const idSchema = z.string().uuid();

const patchBodySchema = z.object({
  enabled: z.boolean(),
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
 * Nested routes for /workspaces/:id/providers.
 * Requires the parent router to have already validated req.user (requireAuth middleware).
 */
export function createWorkspaceProvidersRoutes(
  providersRepo: WorkspaceProvidersRepository,
  workspaceRepo: WorkspaceRepository
): Router {
  const router = Router({ mergeParams: true });

  // GET /workspaces/:id/providers — admin any; member own-ws only
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

      const providerList = await providersRepo.listForWorkspace(wsId);
      res.json({ providers: providerList });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /workspaces/:id/providers/:providerId — admin-only; toggle enabled
  router.patch("/:providerId", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const parsedProviderId = idSchema.safeParse((req.params as Record<string, string>).providerId);
      if (!parsedProviderId.success) {
        res.status(404).json({ code: "provider_not_found", message: "Provider not found" });
        return;
      }
      const providerId = parsedProviderId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const parsedBody = patchBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const result = await providersRepo.setEnabled(wsId, providerId, parsedBody.data.enabled);
      if (!result) {
        res.status(404).json({ code: "provider_not_found", message: "Provider not found" });
        return;
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
