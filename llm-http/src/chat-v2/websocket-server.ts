import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { User, ChatEvent, ConversationRepository, MessageRepository } from "@ai-connect/shared";
import type { JwtService } from "../auth/jwt-service.js";
import type { EventBus } from "../events/event-bus.js";
import type { ConnectionRegistry } from "../transport/connection-registry.js";
import type { ActiveWorkspaceResolver } from "../workspace/active-workspace-resolver.js";
import type { WorkspaceMembersRepository } from "../workspace/workspace-members-repository.js";
import type { WorkspaceTemplatesRepository } from "../workspace/workspace-templates-repository.js";
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
  activeWorkspaceResolver: ActiveWorkspaceResolver;
  workspaceMembersRepository: WorkspaceMembersRepository;
  workspaceTemplatesRepository: WorkspaceTemplatesRepository;
  logger: Logger;
}

export interface V2WebSocketHandle {
  wss: WebSocketServer;
  close: () => Promise<void>;
}

export function attachChatV2Server(httpServer: Server, deps: V2ServerDeps): V2WebSocketHandle {
  const wss = new WebSocketServer({ noServer: true });

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
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
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
      activeWorkspaceResolver: deps.activeWorkspaceResolver,
      workspaceMembersRepository: deps.workspaceMembersRepository,
      workspaceTemplatesRepository: deps.workspaceTemplatesRepository,
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
