import http from "node:http";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { buildContainer, type AppContainer } from "./container.js";
import { createApp } from "./app.js";
import { attachWebSocketServer, type WebSocketHandle } from "./ws/ws-server.js";
import { attachChatHandler } from "./chat/chat-ws-handler.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);
  const container = buildContainer(config, logger);
  const app = createApp(container);
  const server = http.createServer(app);

  const ws = attachWebSocketServer(server, container);
  ws.onConnection(attachChatHandler(container.wsCommandHandlers, container.logger));

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server listening");
  });

  const shutdown = createShutdownHandler(server, ws, container, logger);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function createShutdownHandler(
  server: http.Server,
  ws: WebSocketHandle,
  container: AppContainer,
  logger: { info: (msg: string) => void }
) {
  return async () => {
    logger.info("Shutting down gracefully...");
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
