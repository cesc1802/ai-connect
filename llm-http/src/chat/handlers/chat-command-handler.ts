import type { ClientMessage } from "@ai-connect/shared";
import type { WsCommandHandler, SendFn, HandlerContext } from "./ws-command-handler.js";
import type { AuthenticatedSocket } from "../../ws/ws-types.js";
import type { StreamChatUseCase } from "../stream-chat-use-case.js";
import { mapErrorToCode, sanitizeErrorMessage } from "../error-mapper.js";

type ChatMessage = Extract<ClientMessage, { type: "chat" }>;

const DEFAULT_MAX_TOKENS = 4096;

export class ChatCommandHandler implements WsCommandHandler<ChatMessage> {
  readonly type = "chat" as const;

  constructor(private readonly streamChat: StreamChatUseCase) {}

  handle(
    _socket: AuthenticatedSocket,
    msg: ChatMessage,
    send: SendFn,
    ctx: HandlerContext
  ): void {
    ctx.activeStream.handle?.abort();

    const id = msg.id;
    ctx.activeStream.handle = this.streamChat.execute(
      {
        model: msg.model,
        messages: msg.messages,
        maxTokens: msg.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(msg.temperature !== undefined && { temperature: msg.temperature }),
      },
      {
        onChunk: (delta) => send({ type: "chunk", id, delta }),
        onDone: (usage, finishReason) => {
          send({ type: "done", id, usage, finishReason });
          ctx.activeStream.handle = null;
        },
        onError: (err) => {
          send({ type: "error", id, code: mapErrorToCode(err), message: sanitizeErrorMessage(err) });
          ctx.activeStream.handle = null;
        },
      }
    );
  }
}
