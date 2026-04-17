import http from "node:http";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { buildContainer, type AppContainer } from "./container.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);
  const container = buildContainer(config, logger);
  const app = createApp(container);
  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server listening");
  });

  const shutdown = createShutdownHandler(server, container, logger);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function createShutdownHandler(
  server: http.Server,
  container: AppContainer,
  logger: { info: (msg: string) => void }
) {
  return async () => {
    logger.info("Shutting down gracefully...");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await container.chatGateway.dispose();
    process.exit(0);
  };
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
