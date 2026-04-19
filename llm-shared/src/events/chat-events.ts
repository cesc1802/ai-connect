import type { ChatMessage, TokenUsage, FinishReason } from "../types/re-exports.js";

export type TokenDelta =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_use_start"; toolCallId: string; name: string }
  | { kind: "tool_use_delta"; toolCallId: string; arguments: string };

export type ChatEvent =
  | ChatRequested
  | StreamStarted
  | TokenGenerated
  | ToolCallEvent
  | StreamCompleted
  | StreamFailed
  | StreamAborted;

export interface ChatRequested {
  type: "chat.requested";
  requestId: string;
  userId: string;
  conversationId: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface StreamStarted {
  type: "stream.started";
  requestId: string;
  userId: string;
  conversationId: string;
  model: string;
  startedAt: number;
}

export interface TokenGenerated {
  type: "token.generated";
  requestId: string;
  delta: TokenDelta;
  index: number;
}

export interface ToolCallEvent {
  type: "tool.call";
  requestId: string;
  toolCallId: string;
  name: string;
  arguments: string;
}

export interface StreamCompleted {
  type: "stream.completed";
  requestId: string;
  usage: TokenUsage;
  finishReason: FinishReason;
  latencyMs: number;
}

export interface StreamFailed {
  type: "stream.failed";
  requestId: string;
  code: string;
  message: string;
}

export interface StreamAborted {
  type: "stream.aborted";
  requestId: string;
  reason: "client" | "timeout" | "manual";
}

export type ChatEventType = ChatEvent["type"];

const CHAT_EVENT_TYPES: readonly ChatEventType[] = [
  "chat.requested",
  "stream.started",
  "token.generated",
  "tool.call",
  "stream.completed",
  "stream.failed",
  "stream.aborted",
];

export function isChatEvent(event: unknown): event is ChatEvent {
  if (typeof event !== "object" || event === null || !("type" in event)) {
    return false;
  }
  const type = (event as { type: unknown }).type;
  return typeof type === "string" && CHAT_EVENT_TYPES.includes(type as ChatEventType);
}
