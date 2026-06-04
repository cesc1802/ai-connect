import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from './auth-store';

export type ChatModelSelection = { providerId: string; modelId: string };

type ChatModelState = {
  byWorkspace: Record<string, ChatModelSelection>;
  setModel: (workspaceId: string, sel: ChatModelSelection) => void;
  getModel: (workspaceId: string) => ChatModelSelection | null;
  clearAll: () => void;
};

export const useChatModelStore = create<ChatModelState>()(
  persist(
    (set, get) => ({
      byWorkspace: {},
      setModel: (workspaceId, sel) =>
        set((state) => ({
          byWorkspace: { ...state.byWorkspace, [workspaceId]: sel },
        })),
      getModel: (workspaceId) => get().byWorkspace[workspaceId] ?? null,
      clearAll: () => set({ byWorkspace: {} }),
    }),
    {
      name: 'chat-model-selection',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ byWorkspace: state.byWorkspace }),
    },
  ),
);

let prevAccessToken = useAuthStore.getState().accessToken;
useAuthStore.subscribe((state) => {
  const next = state.accessToken;
  if (prevAccessToken != null && next == null) {
    useChatModelStore.getState().clearAll();
  }
  prevAccessToken = next;
});
