import { Router } from "express";
import type { WorkspaceMembersRepository } from "./workspace-members-repository.js";

/**
 * GET /api/me/workspaces — every workspace the caller belongs to, with the
 * workspace roles they hold there. Feeds the chat workspace switcher.
 */
export function createMeWorkspacesRoutes(
  membersRepo: WorkspaceMembersRepository
): Router {
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

      const memberships = await membersRepo.listMembershipsForUser(
        req.user.id
      );
      res.json({
        workspaces: memberships.map((m) => ({
          id: m.workspaceId,
          slug: m.slug,
          name: m.name,
          roles: m.roles,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
