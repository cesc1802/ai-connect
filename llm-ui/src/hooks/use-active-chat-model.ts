import { useCallback } from 'react';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import {
  useChatModelStore,
  type ChatModelSelection,
} from '@/stores/chat-model-store';

export function useActiveChatModel() {
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const selection = useChatModelStore((s) =>
    workspaceId ? s.byWorkspace[workspaceId] ?? null : null,
  );
  const setModelInStore = useChatModelStore((s) => s.setModel);

  const setSelection = useCallback(
    (sel: ChatModelSelection) => {
      if (workspaceId == null) return;
      setModelInStore(workspaceId, sel);
    },
    [workspaceId, setModelInStore],
  );

  return { selection, setSelection };
}
