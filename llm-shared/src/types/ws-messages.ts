import type { ChatMessage, TokenUsage, FinishReason } from "llm-gateway";

export type ClientMessage =
  | {
      type: "chat";
      id: string;
      model: string;
      messages: ChatMessage[];
      maxTokens?: number;
      temperature?: number;
    }
  | { type: "ping"; id?: string };

export type ServerMessage =
  | { type: "chunk"; id: string; delta: string }
  | { type: "done"; id: string; usage: TokenUsage; finishReason: FinishReason }
  | { type: "error"; id?: string; code: string; message: string }
  | { type: "pong"; id?: string };
