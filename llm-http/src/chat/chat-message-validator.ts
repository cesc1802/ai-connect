import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat"),
    id: z.string().min(1).max(64),
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    maxTokens: z.number().int().positive().max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  z.object({
    type: z.literal("ping"),
    id: z.string().optional(),
  }),
]);

export type ValidClientMessage = z.infer<typeof clientMessageSchema>;
