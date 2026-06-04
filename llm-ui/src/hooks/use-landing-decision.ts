import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { listWorkspaces } from '@/api/workspaces';
import { useAuthStore } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { router } from '@/router';
import type { Workspace } from '@/schemas/workspace';

type Status = 'pending' | 'ready';

/**
 * UC-036 post-sign-in landing decision tree. Runs once per bootstrap, AFTER
 * the refresh attempt has completed:
 *   1. No auth → ready immediately; route guards will redirect to /login.
 *   2. Auth + activeWorkspaceId already set + still valid → ready, current
 *      route stands (covers in-session reloads).
 *   3. Auth + last-used id valid in workspace list → restore, bypass picker,
 *      go to /chat.
 *   4. Auth + last-used id invalid → clear store, toast notice, go to picker.
 *   5. Auth + no last-used + memberships exist → go to picker (UC-036 A1).
 *   6. Auth + no memberships → go to /no-workspace (UC-036 A2, FR-044).
 *   7. Auth + workspaces fetch fails → leave router alone; the picker (or
 *      any route the user lands on) handles error UI separately.
 *
 * Token-free: workspace role comes from the GET /workspaces response
 * (NFR-026, BR-076). Sidebar context is forced back to 'workspace' so a
 * reload while in org context lands users in the workspace view again.
 */
export function useLandingDecision(authReady: boolean): { status: Status } {
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      setStatus('ready');
      return;
    }

    void (async () => {
      try {
        const res = await listWorkspaces();
        if (cancelled) return;
        const workspaces: Workspace[] = res.workspaces;

        const { activeWorkspaceId } = useActiveWorkspaceStore.getState();
        const setActiveWorkspace =
          useActiveWorkspaceStore.getState().setActiveWorkspace;
        const setContext = useSidebarUiStore.getState().setContext;

        if (workspaces.length === 0) {
          setActiveWorkspace(null, null);
          setContext('workspace');
          await router.navigate({ to: '/no-workspace', replace: true });
          return;
        }

        if (activeWorkspaceId) {
          const stillValid = workspaces.find((w) => w.id === activeWorkspaceId);
          if (stillValid) {
            // Refresh role from the authoritative list, in case it changed
            // since the previous session.
            setActiveWorkspace(stillValid.id, stillValid.role);
            setContext('workspace');
            return;
          }
          setActiveWorkspace(null, null);
          setContext('workspace');
          toast.message(
            'Your previous workspace is no longer available. Pick another.',
          );
          await router.navigate({ to: '/workspaces/pick', replace: true });
          return;
        }

        // No last-used → defer to picker (which auto-selects singletons).
        setContext('workspace');
        await router.navigate({ to: '/workspaces/pick', replace: true });
      } catch {
        // Workspaces fetch failed (network/5xx). Don't redirect — let the
        // user reach the picker / chat route which renders its own error.
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady]);

  return { status };
}
