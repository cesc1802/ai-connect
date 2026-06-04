import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ActiveWorkspaceState = {
  activeWorkspaceId: string | null;
  setWorkspace: (id: string | null) => void;
};

export const useActiveWorkspaceStore = create<ActiveWorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),
    }),
    {
      name: 'active-workspace',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId }),
    },
  ),
);
