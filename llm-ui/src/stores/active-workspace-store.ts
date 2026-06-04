import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WorkspaceRole } from '@/schemas/workspace';

type ActiveWorkspaceState = {
  activeWorkspaceId: string | null;
  activeWorkspaceRole: WorkspaceRole | null;
  setActiveWorkspace: (id: string | null, role: WorkspaceRole | null) => void;
  clear: () => void;
};

export const useActiveWorkspaceStore = create<ActiveWorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      activeWorkspaceRole: null,
      setActiveWorkspace: (activeWorkspaceId, activeWorkspaceRole) =>
        set({ activeWorkspaceId, activeWorkspaceRole }),
      clear: () => set({ activeWorkspaceId: null, activeWorkspaceRole: null }),
    }),
    {
      name: 'active-workspace',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
        activeWorkspaceRole: state.activeWorkspaceRole,
      }),
    },
  ),
);
