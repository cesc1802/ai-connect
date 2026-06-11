import express, { type Express } from "express";
import type { AppContainer } from "./container.js";
import { createHealthRoutes } from "./health/health-routes.js";
import { createAuthRoutes } from "./auth/auth-routes.js";
import {
  createRequireAuth,
  createRequireOrgAdmin,
  createRequireWorkspaceAdmin,
} from "./auth/auth-middleware.js";
import { createActiveWorkspaceRoutes } from "./workspace/active-workspace-routes.js";
import { createWorkspaceRoutes } from "./workspace/workspace-routes.js";
import { createPromptTemplatesRoutes } from "./workspace/prompt-templates-routes.js";
import { createUsersRoutes } from "./users/users-routes.js";
import { createOrgUsersRoutes } from "./admin/org/users-routes.js";
import { createOrgTemplatesRouter } from "./admin/org/templates-routes.js";
import { createOrgProvidersRoutes } from "./admin/org/providers-routes.js";
import { createProvidersRoutes } from "./providers/providers-routes.js";
import { createWsMembersRoutes } from "./admin/workspace/members-routes.js";
import { createWsRolesRoutes } from "./admin/workspace/roles-routes.js";
import { createWsProvidersRoutes } from "./admin/workspace/ws-providers-routes.js";
import { createWsTemplatesRoutes } from "./admin/workspace/ws-templates-routes.js";
import { createWsQuotasRoutes } from "./admin/workspace/quotas-routes.js";
import { createRedactLogMiddleware } from "./admin/redact-log-middleware.js";
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
