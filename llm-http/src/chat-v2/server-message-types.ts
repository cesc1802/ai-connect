import type { Conversation, TokenUsage, FinishReason, TokenDelta } from "@ai-connect/shared";

export interface ChatStartedMessage {
  type: "s.chat.started";
  requestId: string;
  conversationId: string;
  model: string;
  startedAt: number;
}

export interface ChatTokenMessage {
  type: "s.chat.token";
  requestId: string;
  delta: TokenDelta;
  index: number;
}

export interface ChatCompletedMessage {
  type: "s.chat.completed";
  requestId: string;
  usage: TokenUsage;
  finishReason: FinishReason;
  latencyMs: number;
}

export interface ChatFailedMessage {
  type: "s.chat.failed";
  requestId: string;
  code: string;
  message: string;
}

export interface ChatAbortedMessage {
  type: "s.chat.aborted";
  requestId: string;
  reason: "client" | "timeout" | "manual";
}

export interface ConversationCreatedMessage {
  type: "s.conversation.created";
  conversation: Conversation;
}

export interface ErrorMessage {
  type: "s.error";
  code: string;
  message: string;
}

export interface PongMessage {
  type: "s.pong";
}

export type ServerV2Message =
  | ChatStartedMessage
  | ChatTokenMessage
  | ChatCompletedMessage
  | ChatFailedMessage
  | ChatAbortedMessage
  | ConversationCreatedMessage
  | ErrorMessage
  | PongMessage;
