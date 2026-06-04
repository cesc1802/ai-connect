import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { resetWorkspaceScopedCaches } from '@/lib/workspace-cache';
import { useWorkspaces } from '@/hooks/use-workspaces';
import type { Workspace } from '@/schemas/workspace';

/**
 * Switches the active workspace using the client-state model (decision 2 of
 * the plan): role is read directly from the target Workspace entry; no token
 * is re-minted. Order matters — caches are reset BEFORE the id flips so
 * in-flight queries don't bleed across workspaces.
 */
export function useWorkspaceSwitch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setActiveWorkspace = useActiveWorkspaceStore((s) => s.setActiveWorkspace);
  const setContext = useSidebarUiStore((s) => s.setContext);
  const { data, refetch } = useWorkspaces();

  return useCallback(
    async (target: Workspace) => {
      const current = useActiveWorkspaceStore.getState();
      if (target.id === current.activeWorkspaceId) return;

      const known = data?.workspaces.find((w) => w.id === target.id);
      if (!known) {
        const refetched = await refetch();
        const stillMissing = !refetched.data?.workspaces.find(
          (w) => w.id === target.id,
        );
        if (stillMissing) {
          toast.error('That workspace is no longer available.');
          return;
        }
      }

      resetWorkspaceScopedCaches(queryClient);
      setActiveWorkspace(target.id, target.role);
      setContext('workspace');
      void navigate({ to: '/chat' });
    },
    [data, refetch, queryClient, setActiveWorkspace, setContext, navigate],
  );
}

/**
 * UC-030 "Back to Workspace": restore last-used valid workspace + switch
 * context back to workspace. Falls back to the picker when the last-used id
 * is no longer a valid membership (UC-030 A2) or to /chat anyway when
 * unknown — the chat-route's no-workspace guard owns UC-030 A1.
 */
export function useReturnToWorkspace() {
  const navigate = useNavigate();
  const setContext = useSidebarUiStore((s) => s.setContext);
  const setActiveWorkspace = useActiveWorkspaceStore((s) => s.setActiveWorkspace);
  const { data } = useWorkspaces();

  return useCallback(() => {
    const lastId = useActiveWorkspaceStore.getState().activeWorkspaceId;
    const lastValid = lastId
      ? data?.workspaces.find((w) => w.id === lastId)
      : undefined;

    setContext('workspace');

    if (lastValid) {
      setActiveWorkspace(lastValid.id, lastValid.role);
      void navigate({ to: '/chat' });
      return;
    }

    if (lastId && data) {
      // last-used revoked since (UC-030 A2)
      setActiveWorkspace(null, null);
      toast.message('Your previous workspace is no longer available.');
      void navigate({ to: '/workspaces/pick' });
      return;
    }

    void navigate({ to: '/workspaces/pick' });
  }, [data, navigate, setActiveWorkspace, setContext]);
}
