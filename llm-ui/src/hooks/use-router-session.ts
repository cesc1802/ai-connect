import { useAuthStore } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import type { SessionState } from '@/router/routes/root-route';

/**
 * Derives the router-level SessionState from the auth + active-workspace stores.
 * workspaceRole comes from the active-workspace store (seeded from GET /workspaces);
 * falls back to the auth user's static role only on cold start before the store hydrates.
 * Client role is UX-only; server re-checks every admin endpoint.
 */
export function useRouterSession(): SessionState | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const activeWorkspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspaceRole = useActiveWorkspaceStore((s) => s.activeWorkspaceRole);

  if (!accessToken || !user) return null;
  return {
    userId: user.id,
    workspaceId: activeWorkspaceId ?? user.workspaceId,
    orgRole: user.orgRole,
    workspaceRole: activeWorkspaceRole ?? user.workspaceRole,
  };
}
