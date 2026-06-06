import http from "node:http";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { buildContainer, type AppContainer } from "./container.js";
import { createApp } from "./app.js";
import { attachWebSocketServer, type WebSocketHandle } from "./ws/ws-server.js";
import { attachChatHandler } from "./chat/chat-ws-handler.js";
import { attachChatV2Server, type V2WebSocketHandle } from "./chat-v2/index.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);
  const container = buildContainer(config, logger);
  const app = createApp(container);
  const server = http.createServer(app);

  // Attach order matters: legacy WS first, then v2.
  // attachChatV2Server removes existing "upgrade" listeners and re-dispatches
  // non-v2 paths to the previously-attached handlers. If v2 attaches first,
  // the legacy listener is registered after the takeover and bypasses the
  // path filter entirely.
  const ws = attachWebSocketServer(server, container);
  ws.onConnection(attachChatHandler(container.wsCommandHandlers, container.logger));

  const v2 = attachChatV2Server(server, {
    jwtService: container.jwtService,
    bus: container.bus,
    chatHandler: container.chatHandler,
    registry: container.registry,
    convRepo: container.convRepo,
    msgRepo: container.msgRepo,
    logger: container.logger,
  });

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server listening");
  });

  const shutdown = createShutdownHandler(server, ws, v2, container, logger);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function createShutdownHandler(
  server: http.Server,
  ws: WebSocketHandle,
  v2: V2WebSocketHandle,
  container: AppContainer,
  logger: { info: (msg: string) => void }
) {
  return async () => {
    logger.info("Shutting down gracefully...");
    await v2.close();
    await container.chatHandler.dispose();
    await ws.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await container.chatGateway.dispose();
    process.exit(0);
  };
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
