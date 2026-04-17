import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { AppContainer } from "../container.js";
import { authenticateUpgrade } from "./ws-upgrade-auth.js";
import type { AuthenticatedSocket, ConnectionListener } from "./ws-types.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

export interface WebSocketHandle {
  wss: WebSocketServer;
  onConnection: (fn: ConnectionListener) => void;
  close: () => Promise<void>;
}

export function attachWebSocketServer(
  httpServer: Server,
  container: AppContainer
): WebSocketHandle {
  const wss = new WebSocketServer({ noServer: true });
  const listeners: ConnectionListener[] = [];

  httpServer.on("upgrade", (req, socket, head) => {
    const result = authenticateUpgrade(req, container.jwtService);
    if ("error" in result) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const authed = ws as AuthenticatedSocket;
      authed.user = result.user;
      authed.isAlive = true;
      wss.emit("connection", authed, req);
    });
  });

  wss.on("connection", (ws: AuthenticatedSocket) => {
    container.logger.info({ user: ws.user.username }, "ws connected");
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("close", () => {
      container.logger.info({ user: ws.user.username }, "ws disconnected");
    });
    listeners.forEach((fn) => fn(ws));
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authed = ws as AuthenticatedSocket;
      if (!authed.isAlive) {
        ws.terminate();
        return;
      }
      authed.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(interval));

  return {
    wss,
    onConnection(fn: ConnectionListener) {
      listeners.push(fn);
    },
    close: () => new Promise<void>((resolve) => wss.close(() => resolve())),
  };
}
