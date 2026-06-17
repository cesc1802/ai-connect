import { Router } from "express";
import { z } from "zod";
import { guardrailPolicySchema, type GuardrailPolicyRepository } from "@ai-connect/shared";
import type { WorkspaceRepository } from "../workspace/workspace-repository.js";

const idSchema = z.string().uuid();

function res401(res: { status: (c: number) => { json: (b: unknown) => unknown } }) {
  res.status(401).json({ code: "missing_token", message: "Authorization header required" });
}
function res403(res: Parameters<typeof res401>[0]) {
  res.status(403).json({ code: "role_required", message: "Forbidden" });
}
function notFoundWorkspace(res: Parameters<typeof res401>[0]) {
  res.status(404).json({ code: "workspace_not_found", message: "Workspace not found" });
}

/**
 * Nested routes for /workspaces/:id/guardrails. The parent router has already
 * run requireAuth. Authz mirrors the sibling provider routes: GET = workspace
 * member (admins see any), PUT = system admin only. A non-member GET reads as
 * 404 so foreign workspace ids don't leak existence.
 */
export function createGuardrailPolicyRoutes(
  policyRepo: GuardrailPolicyRepository,
  workspaceRepo: WorkspaceRepository,
): Router {
  const router = Router({ mergeParams: true });

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

      res.json(await policyRepo.get(wsId));
    } catch (err) {
      next(err);
    }
  });

  router.put("/", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const parsedBody = guardrailPolicySchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      // Normalize optional `options`: zod infers `options?: X | undefined`, but
      // the policy type forbids the explicit undefined (exactOptionalPropertyTypes).
      await policyRepo.upsert(wsId, {
        enabled: parsedBody.data.enabled,
        checks: parsedBody.data.checks.map((c) => ({
          kind: c.kind,
          enabled: c.enabled,
          action: c.action,
          ...(c.options ? { options: c.options } : {}),
        })),
      });
      res.json(await policyRepo.get(wsId));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
