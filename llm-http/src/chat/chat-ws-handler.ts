import type { ServerMessage, ClientMessage } from "@ai-connect/shared";
import type { AppContainer } from "../container.js";
import type { AuthenticatedSocket } from "../ws/ws-types.js";
import type { HandlerContext, WsCommandHandler, SendFn } from "./handlers/ws-command-handler.js";
import { clientMessageSchema } from "./chat-message-validator.js";

const BACKPRESSURE_MAX = 1_000_000;
const MESSAGE_SIZE_LIMIT = 1_000_000;

export type WsCommandHandlerMap = {
  [K in ClientMessage["type"]]?: WsCommandHandler<Extract<ClientMessage, { type: K }>>;
};

export function attachChatHandler(
  handlers: WsCommandHandlerMap,
  logger: AppContainer["logger"]
) {
  return (ws: AuthenticatedSocket) => {
    const ctx: HandlerContext = { activeStream: { handle: null } };

    const send: SendFn = (msg: ServerMessage) => {
      if (ws.bufferedAmount > BACKPRESSURE_MAX) {
        logger.warn({ user: ws.user.username }, "backpressure: dropping message");
        return;
      }
      ws.send(JSON.stringify(msg));
    };

    ws.on("close", () => {
      ctx.activeStream.handle?.abort();
    });

    ws.on("message", (raw) => {
      const rawStr = raw.toString();
      if (rawStr.length > MESSAGE_SIZE_LIMIT) {
        send({ type: "error", code: "message_too_large", message: "Message exceeds 1MB limit" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawStr);
      } catch {
        send({ type: "error", code: "invalid_json", message: "Message must be valid JSON" });
        return;
      }

      const result = clientMessageSchema.safeParse(parsed);
      if (!result.success) {
        send({
          type: "error",
          code: "invalid_message",
          message: result.error.issues[0]?.message ?? "Invalid message format",
        });
        return;
      }

      const msg = result.data;
      const handler = handlers[msg.type];
      if (!handler) {
        send({ type: "error", code: "unknown_type", message: `No handler for type: ${msg.type}` });
        return;
      }

      handler.handle(ws, msg as never, send, ctx);
    });
  };
}
