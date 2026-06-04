import { create } from 'zustand';

/**
 * Shared seed/insert channel between sidebar template clicks and the chat
 * composer. Kept tiny on purpose: not persisted, no per-conversation history,
 * one in-flight payload at a time. The composer consumes the payload on mount
 * (seed) or when it changes (insert) and then clears it.
 */
type ComposerDraftPayload = {
  /** Monotonic key so the composer can react to repeat applies of the same template. */
  id: number;
  text: string;
  /** 'seed' = replace empty draft once on mount. 'insert' = splice into current draft. */
  mode: 'seed' | 'insert';
};

type ComposerDraftState = {
  pending: ComposerDraftPayload | null;
  push: (input: { text: string; mode: 'seed' | 'insert' }) => void;
  consume: () => ComposerDraftPayload | null;
  clear: () => void;
};

let nextId = 1;

export const useComposerDraftStore = create<ComposerDraftState>((set, get) => ({
  pending: null,
  push: ({ text, mode }) =>
    set({ pending: { id: nextId++, text, mode } }),
  consume: () => {
    const current = get().pending;
    set({ pending: null });
    return current;
  },
  clear: () => set({ pending: null }),
}));
