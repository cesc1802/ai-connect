import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
});

export const clientV2MessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("c.chat.send"),
    conversationId: z.string().uuid().optional(),
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

export type ClientV2Message = z.infer<typeof clientV2MessageSchema>;
export type ChatSendMessage = Extract<ClientV2Message, { type: "c.chat.send" }>;
export type ChatAbortMessage = Extract<ClientV2Message, { type: "c.chat.abort" }>;
export type PingMessage = Extract<ClientV2Message, { type: "c.ping" }>;
