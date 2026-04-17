import express, { type Express } from "express";
import type { AppContainer } from "./container.js";
import { createHealthRoutes } from "./health/health-routes.js";
import { createAuthRoutes } from "./auth/auth-routes.js";
import { createErrorHandler } from "./shared/error-handler.js";

export function createApp(container: AppContainer): Express {
  const app = express();
  const isProd = container.config.NODE_ENV === "production";

  app.use(express.json());

  app.use("/health", createHealthRoutes(container));
  app.use("/auth", createAuthRoutes(container));

  app.use(createErrorHandler(container.logger, isProd));

  return app;
}
