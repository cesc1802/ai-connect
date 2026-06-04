import { z } from 'zod';

// ----- client → server commands -----

export const ChatSendCmd = z.object({
  type: z.literal('c.chat.send'),
  conversationId: z.string().nullable(),
  workspaceId: z.string(),
  message: z.object({
    role: z.literal('user'),
    content: z.string().min(1),
  }),
  modelHint: z.string().optional(),
});
export type ChatSendCmd = z.infer<typeof ChatSendCmd>;

export const ChatAbortCmd = z.object({
  type: z.literal('c.chat.abort'),
  conversationId: z.string(),
  messageId: z.string(),
});
export type ChatAbortCmd = z.infer<typeof ChatAbortCmd>;

export const PingCmd = z.object({
  type: z.literal('c.ping'),
  ts: z.number(),
});
export type PingCmd = z.infer<typeof PingCmd>;

export const WsClientCommand = z.discriminatedUnion('type', [
  ChatSendCmd,
  ChatAbortCmd,
  PingCmd,
]);
export type WsClientCommand = z.infer<typeof WsClientCommand>;

// ----- server → client events -----

export const ChatStartedEvt = z.object({
  type: z.literal('s.chat.started'),
  conversationId: z.string(),
  messageId: z.string(),
});
export type ChatStartedEvt = z.infer<typeof ChatStartedEvt>;

export const ChatTokenEvt = z.object({
  type: z.literal('s.chat.token'),
  conversationId: z.string(),
  messageId: z.string(),
  delta: z.string(),
});
export type ChatTokenEvt = z.infer<typeof ChatTokenEvt>;

export const ChatCompletedEvt = z.object({
  type: z.literal('s.chat.completed'),
  conversationId: z.string(),
  messageId: z.string(),
  finishReason: z.enum(['stop', 'length', 'error', 'aborted']),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
    })
    .optional(),
});
export type ChatCompletedEvt = z.infer<typeof ChatCompletedEvt>;

export const ChatAbortedEvt = z.object({
  type: z.literal('s.chat.aborted'),
  conversationId: z.string(),
  messageId: z.string(),
});
export type ChatAbortedEvt = z.infer<typeof ChatAbortedEvt>;

export const ConversationTitleGeneratedEvt = z.object({
  type: z.literal('s.conversation.title_generated'),
  conversationId: z.string(),
  title: z.string(),
});
export type ConversationTitleGeneratedEvt = z.infer<
  typeof ConversationTitleGeneratedEvt
>;

export const PongEvt = z.object({
  type: z.literal('s.pong'),
  ts: z.number(),
});
export type PongEvt = z.infer<typeof PongEvt>;

export const ErrorEvt = z.object({
  type: z.literal('s.error'),
  code: z.string(),
  message: z.string(),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
});
export type ErrorEvt = z.infer<typeof ErrorEvt>;

export const WsServerEvent = z.discriminatedUnion('type', [
  ChatStartedEvt,
  ChatTokenEvt,
  ChatCompletedEvt,
  ChatAbortedEvt,
  ConversationTitleGeneratedEvt,
  PongEvt,
  ErrorEvt,
]);
export type WsServerEvent = z.infer<typeof WsServerEvent>;
