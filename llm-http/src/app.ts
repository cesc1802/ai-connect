import express, { type Express } from "express";
import type { AppContainer } from "./container.js";
import { createHealthRoutes } from "./health/health-routes.js";
import { createAuthRoutes } from "./auth/auth-routes.js";
import { createChatRestRoutes } from "./chat/chat-rest-routes.js";
import { createRequireAuth } from "./auth/auth-middleware.js";
import { createRateLimit } from "./shared/rate-limit.js";
import { createErrorHandler } from "./shared/error-handler.js";

export function createApp(container: AppContainer): Express {
  const app = express();
  const isProd = container.config.NODE_ENV === "production";
  const { config } = container;

  if (isProd) {
    app.set("trust proxy", 1);
  }

  app.use(express.json({ limit: "1mb" }));

  const loginLimit = createRateLimit({
    windowMs: config.RATE_LIMIT_LOGIN_WINDOW_MS,
    max: config.RATE_LIMIT_LOGIN_MAX,
    keyBy: "ip",
    code: "rate_limited",
    message: "Too many login attempts",
  });

  const chatLimit = createRateLimit({
    windowMs: config.RATE_LIMIT_CHAT_WINDOW_MS,
    max: config.RATE_LIMIT_CHAT_MAX,
    keyBy: "user",
    code: "rate_limited",
    message: "Too many chat requests",
  });

  const requireAuth = createRequireAuth(container);

  app.use("/health", createHealthRoutes(container));
  app.use("/auth/login", loginLimit);
  app.use("/auth", createAuthRoutes(container));
  app.use("/chat", requireAuth, chatLimit, createChatRestRoutes(container));

  app.use(createErrorHandler(container.logger, isProd));

  return app;
}
