import express, { type Express } from "express";
import type { AppContainer } from "./container.js";
import { createHealthRoutes } from "./health/health-routes.js";
import { createAuthRoutes } from "./auth/auth-routes.js";
import {
  createRequireAuth,
  createRequireOrgAdmin,
} from "./auth/auth-middleware.js";
import { createActiveWorkspaceRoutes } from "./workspace/active-workspace-routes.js";
import { createMeWorkspacesRoutes } from "./workspace/me-workspaces-routes.js";
import { createWorkspaceRoutes } from "./workspace/workspace-routes.js";
import { createConversationsRoutes } from "./conversations/conversations-routes.js";
import { createPromptTemplatesRoutes } from "./workspace/prompt-templates-routes.js";
import { createUsersRoutes } from "./users/users-routes.js";
import { createProvidersRoutes } from "./providers/providers-routes.js";
import { createMeDefaultModelRoutes } from "./providers/me-default-model-routes.js";
import { createDashboardRoutes } from "./dashboard/dashboard-routes.js";
import { createUsageRoutes } from "./dashboard/usage-routes.js";
import { createRedactLogMiddleware } from "./shared/redact-log-middleware.js";
import { createRateLimit } from "./shared/rate-limit.js";
import { createCors } from "./shared/cors-middleware.js";
import { createErrorHandler } from "./shared/error-handler.js";

export function createApp(container: AppContainer): Express {
  const app = express();
  const isProd = container.config.NODE_ENV === "production";
  const { config } = container;

  if (isProd) {
    app.set("trust proxy", 1);
  }

  app.use(createCors(config.CORS_ORIGIN));
  app.use(express.json({ limit: "1mb" }));
  app.use(createRedactLogMiddleware());

  // Shared across the unauthenticated auth endpoints (login + register) since
  // both run bcrypt + a DB hit per call and are abuse targets.
  const authLimit = createRateLimit({
    windowMs: config.RATE_LIMIT_LOGIN_WINDOW_MS,
    max: config.RATE_LIMIT_LOGIN_MAX,
    keyBy: "ip",
    code: "rate_limited",
    message: "Too many attempts, please try again later",
  });

  const requireAuth = createRequireAuth(container);

  app.use("/health", createHealthRoutes(container));
  app.use("/auth/login", authLimit);
  app.use("/auth/register", authLimit);
  app.use("/auth", createAuthRoutes(container));
  app.use(
    "/api/me/active-workspace",
    requireAuth,
    createActiveWorkspaceRoutes(container.activeWorkspaceResolver),
  );
  app.use(
    "/api/me/workspaces",
    requireAuth,
    createMeWorkspacesRoutes(container.workspaceMembersRepository),
  );
  app.use(
    "/api/me/default-model",
    requireAuth,
    createMeDefaultModelRoutes(container.orgProvidersRepo),
  );
  app.use(
    "/conversations",
    requireAuth,
    createConversationsRoutes(container.convRepo, container.msgRepo),
  );
  app.use(
    "/workspaces",
    requireAuth,
    createWorkspaceRoutes(
      container.workspaceRepository,
      container.workspaceMembersRepository,
      container.workspaceProvidersRepository,
      container.workspaceTemplatesRepository,
    ),
  );
  app.use(
    "/prompt-templates",
    requireAuth,
    createPromptTemplatesRoutes(container.workspaceTemplatesRepository),
  );
  app.use("/users", requireAuth, createUsersRoutes(container));
  app.use(
    "/api/dashboard",
    requireAuth,
    createDashboardRoutes(
      container.workspaceRepository,
      container.usersService,
      container.orgProvidersRepo,
    ),
  );
  app.use(
    "/api/dashboard",
    requireAuth,
    createUsageRoutes(container.usageRepository, container.workspaceRepository),
  );
  app.use(
    "/providers",
    requireAuth,
    createRequireOrgAdmin(),
    createProvidersRoutes({
      service: container.orgProvidersService,
      repo: container.orgProvidersRepo,
      vault: container.apiKeyVault,
    }),
  );

  app.use(createErrorHandler(container.logger, isProd));

  return app;
}
