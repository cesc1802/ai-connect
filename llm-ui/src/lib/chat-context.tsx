import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { chatReducer } from "./chat-reducer";
import { initialChatState, type ChatAction, type ChatState } from "./chat-types";

interface ChatStoreValue {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
}

const ChatStoreContext = createContext<ChatStoreValue | null>(null);

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>
  );
}

export function useChatStore(): ChatStoreValue {
  const ctx = useContext(ChatStoreContext);
  if (!ctx) {
    throw new Error("useChatStore must be called inside <ChatStoreProvider />");
  }
  return ctx;
}
