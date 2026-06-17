import http from "node:http";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { buildContainer, type AppContainer } from "./container.js";
import { createApp } from "./app.js";
import { attachChatV2Server, type V2WebSocketHandle } from "./chat-v2/index.js";
import { attachMessagePersister } from "./chat-v2/message-persister.js";
import { attachUsageRecorder } from "./usage/usage-recorder.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);
  const container = await buildContainer(config, logger);
  const app = createApp(container);
  const server = http.createServer(app);

  const v2 = attachChatV2Server(server, {
    jwtService: container.jwtService,
    bus: container.bus,
    chatHandler: container.chatHandler,
    registry: container.registry,
    convRepo: container.convRepo,
    msgRepo: container.msgRepo,
    activeWorkspaceResolver: container.activeWorkspaceResolver,
    workspaceMembersRepository: container.workspaceMembersRepository,
    workspaceTemplatesRepository: container.workspaceTemplatesRepository,
    logger: container.logger,
  });

  attachMessagePersister({
    bus: container.bus,
    convRepo: container.convRepo,
    msgRepo: container.msgRepo,
  });

  attachUsageRecorder({
    bus: container.bus,
    convRepo: container.convRepo,
    usageRepo: container.usageRepository,
    resolveActiveProviderId: container.resolveActiveProviderId,
    logger: container.logger,
  });

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server listening");
  });

  const shutdown = createShutdownHandler(server, v2, container, logger);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function createShutdownHandler(
  server: http.Server,
  v2: V2WebSocketHandle,
  container: AppContainer,
  logger: { info: (msg: string) => void }
) {
  return async () => {
    logger.info("Shutting down gracefully...");
    await v2.close();
    await container.chatHandler.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await container.chatGateway.dispose();
    if (container.dbClient) await container.dbClient.close();
    process.exit(0);
  };
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
