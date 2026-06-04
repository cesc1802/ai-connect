import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type SidebarContext = 'workspace' | 'org';

type SidebarUiState = {
  context: SidebarContext;
  collapsed: boolean;
  setContext: (ctx: SidebarContext) => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

export const useSidebarUiStore = create<SidebarUiState>()(
  persist(
    (set) => ({
      context: 'workspace',
      collapsed: false,
      setContext: (context) => set({ context }),
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: 'sidebar-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);

export const useSidebarContext = () => useSidebarUiStore((s) => s.context);
export const useSidebarCollapsed = () => useSidebarUiStore((s) => s.collapsed);
