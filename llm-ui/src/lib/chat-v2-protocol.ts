import { z } from "zod";

// Boundary-validation schemas for the /ws/chat/v2 protocol.
// Mirrors:
//   - llm-http/src/chat-v2/client-message-schema.ts
//   - llm-http/src/chat-v2/server-message-types.ts
//   - llm-shared/src/events/chat-events.ts (TokenDelta)
//   - llm-shared/src/events/repository-types.ts (Conversation)

// --- Client → Server ---

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
});

export const ClientV2MessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("c.chat.send"),
    conversationId: z.string().uuid().optional(),
    workspaceId: z.string().uuid().optional(),
    templateId: z.string().uuid().optional(),
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    maxTokens: z.number().int().positive().max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  z.object({
    type: z.literal("c.chat.abort"),
    requestId: z.string().min(1),
  }),
  z.object({
    type: z.literal("c.ping"),
  }),
]);

export type ClientV2Message = z.infer<typeof ClientV2MessageSchema>;
export type ChatSendMessage = Extract<ClientV2Message, { type: "c.chat.send" }>;
export type ChatAbortMessage = Extract<ClientV2Message, { type: "c.chat.abort" }>;
export type PingMessage = Extract<ClientV2Message, { type: "c.ping" }>;

// --- Token deltas (streamed assistant output) ---

export const TokenDeltaSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("thinking"), text: z.string() }),
  z.object({
    kind: z.literal("tool_use_start"),
    toolCallId: z.string(),
    name: z.string(),
  }),
  z.object({
    kind: z.literal("tool_use_delta"),
    toolCallId: z.string(),
    arguments: z.string(),
  }),
]);

export type TokenDelta = z.infer<typeof TokenDeltaSchema>;

// --- Shared shapes ---

const TokenUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
});

const FinishReasonSchema = z.enum([
  "stop",
  "length",
  "tool_calls",
  "content_filter",
  "error",
]);

const ConversationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  title: z.string().optional(),
  templateId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ChatV2Conversation = z.infer<typeof ConversationSchema>;

// --- Server → Client ---

export const ServerV2MessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("s.chat.started"),
    requestId: z.string(),
    conversationId: z.string(),
    model: z.string(),
    startedAt: z.number(),
  }),
  z.object({
    type: z.literal("s.chat.token"),
    requestId: z.string(),
    delta: TokenDeltaSchema,
    index: z.number(),
  }),
  z.object({
    type: z.literal("s.chat.completed"),
    requestId: z.string(),
    usage: TokenUsageSchema,
    finishReason: FinishReasonSchema,
    latencyMs: z.number(),
  }),
  z.object({
    type: z.literal("s.chat.failed"),
    requestId: z.string(),
    code: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("s.chat.aborted"),
    requestId: z.string(),
    reason: z.enum(["client", "timeout", "manual"]),
  }),
  z.object({
    type: z.literal("s.conversation.created"),
    conversation: ConversationSchema,
  }),
  z.object({
    type: z.literal("s.error"),
    code: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal("s.pong") }),
]);

export type ServerV2Message = z.infer<typeof ServerV2MessageSchema>;

// Synthetic internal event surfaced by ChatV2Client when the socket dies
// mid-stream. NOT a real wire message — Phase 4 reducer consumes this
// to mark active drafts as (stopped, network).
export interface ClientConnectionLostEvent {
  type: "client.connection.lost";
  at: number;
}

// Union the UI's onMessage handler actually sees.
export type ChatV2InboundEvent = ServerV2Message | ClientConnectionLostEvent;
