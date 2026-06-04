import { z } from 'zod';

export const MessageRole = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRole>;

export const Message = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: MessageRole,
  content: z.string(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof Message>;

export const Conversation = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof Conversation>;

export const ConversationListResponse = z.object({
  conversations: z.array(Conversation),
});
export type ConversationListResponse = z.infer<typeof ConversationListResponse>;

export const MessageListResponse = z.object({
  messages: z.array(Message),
});
export type MessageListResponse = z.infer<typeof MessageListResponse>;
