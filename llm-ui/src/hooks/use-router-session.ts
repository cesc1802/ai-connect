import { useAuthStore } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import type { SessionState } from '@/router/routes/root-route';

/**
 * Derives the router-level SessionState from the auth + active-workspace stores.
 * Returns null when the user is not authenticated, which triggers the
 * authenticated-route guard to redirect to /login.
 */
export function useRouterSession(): SessionState | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);

  if (!accessToken) return null;
  return {
    userId: user?.id ?? '',
    workspaceId,
  };
}
