import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type StreamingStatus = 'streaming' | 'completed' | 'aborted' | 'error';

export type StreamingEntry = {
  conversationId: string;
  delta: string;
  status: StreamingStatus;
};

type StreamingState = {
  entries: Record<string, StreamingEntry>;
  start: (messageId: string, conversationId: string) => void;
  appendDelta: (messageId: string, delta: string) => void;
  setStatus: (messageId: string, status: StreamingStatus) => void;
  remove: (messageId: string) => void;
  clear: () => void;
};

export const useStreamingStore = create<StreamingState>((set) => ({
  entries: {},
  start: (messageId, conversationId) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [messageId]: { conversationId, delta: '', status: 'streaming' },
      },
    })),
  appendDelta: (messageId, delta) =>
    set((s) => {
      const prev = s.entries[messageId];
      if (!prev) return s;
      return {
        entries: {
          ...s.entries,
          [messageId]: { ...prev, delta: prev.delta + delta },
        },
      };
    }),
  setStatus: (messageId, status) =>
    set((s) => {
      const prev = s.entries[messageId];
      if (!prev) return s;
      return { entries: { ...s.entries, [messageId]: { ...prev, status } } };
    }),
  remove: (messageId) =>
    set((s) => {
      if (!s.entries[messageId]) return s;
      const next = { ...s.entries };
      delete next[messageId];
      return { entries: next };
    }),
  clear: () => set({ entries: {} }),
}));

export function useStreamingEntry(messageId: string): StreamingEntry | undefined {
  return useStreamingStore((s) => s.entries[messageId]);
}

export function useStreamingMessageIdsFor(conversationId: string | null): string[] {
  return useStreamingStore(
    useShallow((s) =>
      Object.entries(s.entries)
        .filter(([, e]) => e.conversationId === conversationId)
        .map(([id]) => id),
    ),
  );
}
