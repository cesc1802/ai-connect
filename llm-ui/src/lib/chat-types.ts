import type { TokenDelta } from "./chat-v2-protocol";

// State model for the chat UI. Translates ServerV2Message events into
// renderable messages. localId keys drafts before s.chat.started; the
// requestId minted by the server is grafted on once it arrives.

export type Role = "user" | "assistant" | "system" | "tool";

export type ToolCallStatus = "running" | "complete" | "error";

export interface ToolCall {
  id: string; // toolCallId from server
  name: string;
  argsBuffer: string;
  status: ToolCallStatus;
}

export type MsgStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "error"
  | "aborted";

export type AbortReason = "user" | "network";

export interface Msg {
  // Shared between a user message and its paired assistant draft for a
  // single send. React keys should combine localId + role.
  localId: string;
  // Populated on the assistant draft once s.chat.started arrives.
  requestId?: string;
  role: Role;
  text: string;
  toolCalls: ToolCall[];
  status: MsgStatus;
  abortReason?: AbortReason;
  errorCode?: string;
  errorMessage?: string;
}

export type ChatStatus = "idle" | "sending" | "streaming" | "error";

export interface ChatState {
  messages: Msg[];
  // Base localId of the in-flight send, set at SEND_USER, cleared at
  // completion/failure/abort. Always points to a draft whose requestId
  // may or may not be resolved yet.
  activeLocalId: string | null;
  activeRequestId: string | null;
  // localIds whose user pressed abort before s.chat.started arrived.
  // Flushed by use-chat-socket on the matching SERVER_STARTED.
  pendingAbortLocalIds: Set<string>;
  status: ChatStatus;
}

export type ChatAction =
  | { type: "SEND_USER"; localId: string; text: string }
  | {
      type: "SERVER_STARTED";
      requestId: string;
      conversationId: string;
      model: string;
      startedAt: number;
    }
  | { type: "SERVER_TOKEN"; requestId: string; delta: TokenDelta }
  | { type: "SERVER_COMPLETED"; requestId: string }
  | { type: "SERVER_FAILED"; requestId: string; code: string; message: string }
  | {
      type: "SERVER_ABORTED";
      requestId: string;
      reason: "client" | "timeout" | "manual";
    }
  | { type: "ABORT_BEFORE_STARTED"; localId: string }
  | { type: "CONNECTION_LOST" }
  | { type: "LOAD_HISTORY"; messages: Msg[] };

export const initialChatState: ChatState = {
  messages: [],
  activeLocalId: null,
  activeRequestId: null,
  pendingAbortLocalIds: new Set<string>(),
  status: "idle",
};
