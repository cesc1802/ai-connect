import { Router } from "express";
import type { WorkspaceRepository } from "../workspace/workspace-repository.js";
import type { UsersService } from "../users/users-service.js";
import type { ProvidersRepository } from "../providers/providers-repository.js";

// "All workspaces" for the dashboard is conceptually unbounded, but the paged
// repository API requires an explicit ceiling. We pass a limit far above any
// realistic workspace count rather than widening the shared repo contract just
// for this read-only aggregate.
const ALL_WORKSPACES_LIMIT = 10_000;

/**
 * Dashboard overview metrics for the current caller.
 *
 * Scope is role-aware: an admin sees org-wide workspaces and member totals,
 * while a member sees only their own workspaces and the users they share a
 * workspace with. The active-provider count is org-wide for everyone.
 */
export function createDashboardRoutes(
  workspaceRepository: WorkspaceRepository,
  usersService: UsersService,
  providersRepo: ProvidersRepository,
): Router {
  const router = Router();

  router.get("/stats", async (req, res, next) => {
    try {
      const { id, role, org } = req.user!;
      const opts = { limit: ALL_WORKSPACES_LIMIT, offset: 0 };

      const [workspacePage, visibleUsers, providers] = await Promise.all([
        role === "admin"
          ? workspaceRepository.listAll(opts)
          : workspaceRepository.listForUser(id, opts),
        usersService.listVisibleUsers({ id, role }),
        providersRepo.listByOrg(org),
      ]);

      res.json({
        workspaces: workspacePage.items.map((w) => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
        })),
        memberCount: visibleUsers.length,
        activeProviderCount: providers.filter((p) => p.isEnabled).length,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
