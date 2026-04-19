import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { User, ChatEvent, ConversationRepository, MessageRepository } from "@ai-connect/shared";
import type { JwtService } from "../auth/jwt-service.js";
import type { EventBus } from "../events/event-bus.js";
import type { ConnectionRegistry } from "../transport/connection-registry.js";
import type { Logger } from "../logger.js";
import type { ChatHandler } from "./chat-handler.js";
import { authenticateUpgrade } from "../ws/ws-upgrade-auth.js";
import { ConnectionSession } from "./connection-session.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface AuthenticatedSocket {
  user: User;
  isAlive: boolean;
}

export interface V2ServerDeps {
  jwtService: JwtService;
  bus: EventBus<ChatEvent>;
  chatHandler: ChatHandler;
  registry: ConnectionRegistry;
  convRepo: ConversationRepository;
  msgRepo: MessageRepository;
  logger: Logger;
}

export interface V2WebSocketHandle {
  wss: WebSocketServer;
  close: () => Promise<void>;
}

export function attachChatV2Server(httpServer: Server, deps: V2ServerDeps): V2WebSocketHandle {
  const wss = new WebSocketServer({ noServer: true });

  const existingUpgradeListeners = httpServer.listeners("upgrade").slice();

  httpServer.removeAllListeners("upgrade");

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws/chat/v2")) {
      const result = authenticateUpgrade(req, deps.jwtService);
      if ("error" in result) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const authed = ws as typeof ws & AuthenticatedSocket;
        authed.user = result.user;
        authed.isAlive = true;
        wss.emit("connection", authed, req);
      });
    } else {
      for (const listener of existingUpgradeListeners) {
        (listener as (req: unknown, socket: unknown, head: unknown) => void)(req, socket, head);
      }
    }
  });

  wss.on("connection", (ws) => {
    const authed = ws as typeof ws & AuthenticatedSocket;
    const connectionId = randomUUID();

    deps.logger.info({ user: authed.user.username, connectionId }, "v2 ws connected");

    const session = new ConnectionSession(ws, authed.user, {
      bus: deps.bus,
      chatHandler: deps.chatHandler,
      registry: deps.registry,
      convRepo: deps.convRepo,
      msgRepo: deps.msgRepo,
      logger: deps.logger,
    });
    session.start(connectionId);

    ws.on("pong", () => {
      authed.isAlive = true;
    });

    ws.on("close", () => {
      deps.logger.info({ user: authed.user.username, connectionId }, "v2 ws disconnected");
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authed = ws as typeof ws & AuthenticatedSocket;
      if (!authed.isAlive) {
        ws.terminate();
        return;
      }
      authed.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeatInterval));

  return {
    wss,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(heartbeatInterval);
        wss.close(() => resolve());
      }),
  };
}
