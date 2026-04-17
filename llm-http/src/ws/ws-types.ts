import type { WebSocket } from "ws";
import type { User } from "@ai-connect/shared";

export interface AuthenticatedSocket extends WebSocket {
  user: User;
  isAlive: boolean;
}

export type ConnectionListener = (socket: AuthenticatedSocket) => void;
