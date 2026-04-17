import type { AuthenticatedSocket } from "../../ws/ws-types.js";
import type { ServerMessage, ClientMessage } from "@ai-connect/shared";
import type { StreamHandle } from "../stream-chat-use-case.js";

export type SendFn = (msg: ServerMessage) => void;

export interface HandlerContext {
  activeStream: { handle: StreamHandle | null };
}

export interface WsCommandHandler<T extends ClientMessage = ClientMessage> {
  readonly type: T["type"];
  handle(socket: AuthenticatedSocket, msg: T, send: SendFn, ctx: HandlerContext): void;
}
