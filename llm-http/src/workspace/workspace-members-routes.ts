import { Router } from "express";
import { z } from "zod";
import {
  MemberExistsError,
  MemberNotFoundError,
  type WorkspaceMembersRepository,
} from "./workspace-members-repository.js";
import type { WorkspaceRepository } from "./workspace-repository.js";

const idSchema = z.string().uuid();

const wsRoleEnum = z.enum(["wsadmin", "pm", "ba", "qa", "dev"]);
// Dedupe before persisting: the role table's composite PK would turn a
// repeated role in the body into a unique-violation 500 instead of a 400.
const rolesSchema = z
  .array(wsRoleEnum)
  .min(1, "At least one role is required")
  .transform((roles) => [...new Set(roles)]);

const addBodySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  roles: rolesSchema,
});

const patchRolesBodySchema = z.object({
  roles: rolesSchema,
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
 * Nested routes for /workspaces/:id/members.
 * Requires the parent router to have already validated req.user (requireAuth middleware).
 * workspaceRepo is used only for the member-access guard (isMember / getById).
 */
export function createWorkspaceMembersRoutes(
  membersRepo: WorkspaceMembersRepository,
  workspaceRepo: WorkspaceRepository
): Router {
  const router = Router({ mergeParams: true });

  // GET /workspaces/:id/members
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

      const members = await membersRepo.list(wsId);
      res.json({ members });
    } catch (err) {
      next(err);
    }
  });

  // GET /workspaces/:id/members/candidates — admin-only; org users not yet in this workspace
  router.get("/candidates", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const candidates = await membersRepo.listCandidates(wsId);
      res.json({ candidates });
    } catch (err) {
      next(err);
    }
  });

  // POST /workspaces/:id/members — admin-only
  router.post("/", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const parsedBody = addBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      const { userId, roles } = parsedBody.data;

      const exists = await membersRepo.userExists(userId);
      if (!exists) {
        res.status(404).json({ code: "user_not_found", message: "User not found" });
        return;
      }

      await membersRepo.add(wsId, userId, roles);
      res.status(201).json({ userId, roles });
    } catch (err) {
      if (err instanceof MemberExistsError) {
        res.status(409).json({ code: "member_exists", message: "User is already a member" });
        return;
      }
      next(err);
    }
  });

  // PATCH /workspaces/:id/members/:userId — admin-only; replace role set
  router.patch("/:userId", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const parsedUserId = idSchema.safeParse((req.params as Record<string, string>).userId);
      if (!parsedUserId.success) {
        res.status(404).json({ code: "member_not_found", message: "Member not found" });
        return;
      }
      const memberId = parsedUserId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const parsedBody = patchRolesBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          code: "invalid_body",
          message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
        });
        return;
      }

      await membersRepo.replaceRoles(wsId, memberId, parsedBody.data.roles);
      res.json({ userId: memberId, roles: parsedBody.data.roles });
    } catch (err) {
      if (err instanceof MemberNotFoundError) {
        res.status(404).json({ code: "member_not_found", message: "Member not found" });
        return;
      }
      next(err);
    }
  });

  // DELETE /workspaces/:id/members/:userId — admin-only
  router.delete("/:userId", async (req, res, next) => {
    try {
      if (!req.user) { res401(res); return; }
      if (req.user.role !== "admin") { res403(res); return; }

      const parsedId = idSchema.safeParse((req.params as Record<string, string>).id);
      if (!parsedId.success) { notFoundWorkspace(res); return; }
      const wsId = parsedId.data;

      const parsedUserId = idSchema.safeParse((req.params as Record<string, string>).userId);
      if (!parsedUserId.success) {
        res.status(404).json({ code: "member_not_found", message: "Member not found" });
        return;
      }
      const memberId = parsedUserId.data;

      const ws = await workspaceRepo.getById(wsId);
      if (!ws) { notFoundWorkspace(res); return; }

      const removed = await membersRepo.remove(wsId, memberId);
      if (!removed) {
        res.status(404).json({ code: "member_not_found", message: "Member not found" });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
