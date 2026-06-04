import express, { type Express } from "express";
import type { AppContainer } from "./container.js";
import { createHealthRoutes } from "./health/health-routes.js";
import { createAuthRoutes } from "./auth/auth-routes.js";
import { createChatRestRoutes } from "./chat/chat-rest-routes.js";
import {
  createRequireAuth,
  createRequireOrgAdmin,
  createRequireWorkspaceAdmin,
} from "./auth/auth-middleware.js";
import { createOrgUsersRoutes } from "./admin/org/users-routes.js";
import { createOrgTemplatesRouter } from "./admin/org/templates-routes.js";
import { createOrgProvidersRoutes } from "./admin/org/providers-routes.js";
import { createWsMembersRoutes } from "./admin/workspace/members-routes.js";
import { createWsRolesRoutes } from "./admin/workspace/roles-routes.js";
import { createWsProvidersRoutes } from "./admin/workspace/ws-providers-routes.js";
import { createWsTemplatesRoutes } from "./admin/workspace/ws-templates-routes.js";
import { createWsQuotasRoutes } from "./admin/workspace/quotas-routes.js";
import { createRedactLogMiddleware } from "./admin/redact-log-middleware.js";
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
  app.use(createRedactLogMiddleware());

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
  app.use(
    "/admin/org/users",
    requireAuth,
    createRequireOrgAdmin(),
    createOrgUsersRoutes(container),
  );
  app.use(
    "/admin/org/templates",
    requireAuth,
    createRequireOrgAdmin(),
    createOrgTemplatesRouter(container.orgTemplateService),
  );
  app.use(
    "/admin/org/providers",
    requireAuth,
    createRequireOrgAdmin(),
    createOrgProvidersRoutes(container.orgProvidersService),
  );
  app.use(
    "/admin/workspace/members",
    requireAuth,
    createRequireWorkspaceAdmin(),
    createWsMembersRoutes(container),
  );
  app.use(
    "/admin/workspace/roles",
    requireAuth,
    createRequireWorkspaceAdmin(),
    createWsRolesRoutes(),
  );
  app.use(
    "/admin/workspace/providers",
    requireAuth,
    createRequireWorkspaceAdmin(),
    createWsProvidersRoutes(container.wsProvidersService),
  );
  app.use(
    "/admin/workspace/templates",
    requireAuth,
    createRequireWorkspaceAdmin(),
    createWsTemplatesRoutes(container.wsTemplatesService),
  );
  app.use(
    "/admin/workspace/quotas",
    requireAuth,
    createRequireWorkspaceAdmin(),
    createWsQuotasRoutes(container.wsQuotasService),
  );

  app.use(createErrorHandler(container.logger, isProd));

  return app;
}
