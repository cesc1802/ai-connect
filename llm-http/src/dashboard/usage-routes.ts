import { Router } from "express";
import type { UsageRepository, UsageScope } from "@ai-connect/shared";
import type { WorkspaceRepository } from "../workspace/workspace-repository.js";

// "All workspaces" is conceptually unbounded, but listForUser/listAll are paged;
// pass a ceiling far above any realistic workspace count rather than widening the
// shared repo contract for this read-only aggregate (mirrors dashboard-routes).
const ALL_WORKSPACES_LIMIT = 10_000;

/**
 * Role-scoped token usage totals under `/api/dashboard/usage`.
 *
 * Scope mirrors the dashboard: an admin sees org-wide totals; a member sees only
 * the workspaces they belong to — both the by-workspace and the by-provider
 * rollups are filtered to that set so a member never receives provider totals
 * computed across workspaces they cannot access.
 */
export function createUsageRoutes(
  usageRepository: UsageRepository,
  workspaceRepository: WorkspaceRepository,
): Router {
  const router = Router();

  router.get("/usage", async (req, res, next) => {
    try {
      const { id, role } = req.user!;
      const opts = { limit: ALL_WORKSPACES_LIMIT, offset: 0 };

      const workspacePage =
        role === "admin"
          ? await workspaceRepository.listAll(opts)
          : await workspaceRepository.listForUser(id, opts);

      // A member with no workspaces gets empty totals — never org-wide data.
      if (role !== "admin" && workspacePage.items.length === 0) {
        res.json({ byProvider: [], byWorkspace: [] });
        return;
      }

      const scope: UsageScope =
        role === "admin" ? "all" : workspacePage.items.map((w) => w.id);

      const [byProvider, byWorkspace] = await Promise.all([
        usageRepository.aggregateByProvider(scope),
        usageRepository.aggregateByWorkspace(scope),
      ]);

      // Decorate workspace rows with slug/name from the already-fetched list;
      // rows whose workspace is not in the list (none, for the computed scope)
      // are dropped rather than surfaced without a name.
      const byId = new Map(workspacePage.items.map((w) => [w.id, w]));
      const decorated = byWorkspace.flatMap((row) => {
        const ws = byId.get(row.workspaceId);
        return ws ? [{ ...row, slug: ws.slug, name: ws.name }] : [];
      });

      res.json({ byProvider, byWorkspace: decorated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
