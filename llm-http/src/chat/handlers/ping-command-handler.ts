import type { ClientMessage } from "@ai-connect/shared";
import type { WsCommandHandler, SendFn, HandlerContext } from "./ws-command-handler.js";
import type { AuthenticatedSocket } from "../../ws/ws-types.js";

type PingMessage = Extract<ClientMessage, { type: "ping" }>;

export class PingCommandHandler implements WsCommandHandler<PingMessage> {
  readonly type = "ping" as const;

  handle(
    _socket: AuthenticatedSocket,
    msg: PingMessage,
    send: SendFn,
    _ctx: HandlerContext
  ): void {
    send(msg.id ? { type: "pong", id: msg.id } : { type: "pong" });
  }
}
