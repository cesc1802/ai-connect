import { LLMGateway, type ProviderConfigSource } from "llm-gateway";
import type { AuditEmitter } from "@ai-connect/shared";
import type { Config } from "./config.js";
import type { Logger } from "./logger.js";
import type { ChatGatewayPort } from "./chat-v2/chat-gateway-port.js";
import { LlmGatewayAdapter } from "./chat-v2/llm-gateway-adapter.js";
import { DbProviderConfigSource } from "./providers/db-provider-config-source.js";
import type { UserRepository } from "./auth/user-repository.js";
import { DrizzleUserRepository } from "./auth/drizzle-user-repository.js";
import { CredentialsVerifier } from "./auth/credentials-verifier.js";
import { JwtService } from "./auth/jwt-service.js";
import { AuthService } from "./auth/auth-service.js";
import { StdoutAuditEmitter } from "./admin/audit-emitter-stdout.js";
import {
  InMemoryOrgUsersRepository,
  type OrgUserRow,
} from "./admin/org/users-repo.js";
import {
  DefaultOrgUsersService,
  type OrgUsersService,
} from "./admin/org/users-service.js";
import { InMemoryOrgTemplateRepo } from "./admin/org/templates-repo.js";
import { OrgTemplateService } from "./admin/org/templates-service.js";
import { ApiKeyVault } from "./admin/org/api-key-vault.js";
import { DrizzleProvidersRepository } from "./admin/org/drizzle-providers-repo.js";
import { OrgProvidersService } from "./admin/org/providers-service.js";
import {
  InMemoryWsMembersRepository,
  type WsMemberRow,
} from "./admin/workspace/members-repo.js";
import {
  DefaultWsMembersService,
  type WsMembersService,
} from "./admin/workspace/members-service.js";
import { InMemoryWsProviderBindingsRepo } from "./admin/workspace/ws-providers-repo.js";
import { WsProvidersService } from "./admin/workspace/ws-providers-service.js";
import { InMemoryWsTemplateBindingsRepo } from "./admin/workspace/ws-templates-repo.js";
import { WsTemplatesService } from "./admin/workspace/ws-templates-service.js";
import { InMemoryWsQuotasRepo } from "./admin/workspace/quotas-repo.js";
import {
  StubUsageCounter,
  WsQuotasService,
} from "./admin/workspace/quotas-service.js";
import type { ChatEvent } from "@ai-connect/shared";
import { EventBus } from "./events/event-bus.js";
import { LocalConnectionRegistry } from "./transport/local-connection-registry.js";
import type { ConnectionRegistry } from "./transport/connection-registry.js";
import { InMemoryConversationRepository } from "./repositories/in-memory-conversation-repo.js";
import { InMemoryMessageRepository } from "./repositories/in-memory-message-repo.js";
import { DrizzleConversationRepository } from "./repositories/drizzle/conversation-repository.js";
import { DrizzleMessageRepository } from "./repositories/drizzle/message-repository.js";
import type {
  ConversationRepository,
  MessageRepository,
} from "@ai-connect/shared";
import { createDbClient, type DbClient } from "@ai-connect/db";
import { seedDrizzleDevData } from "./auth/seed-users.js";
import { seedPromptTemplates } from "./workspace/seed-prompt-templates.js";
import type { ActiveWorkspaceResolver } from "./workspace/active-workspace-resolver.js";
import { InMemoryActiveWorkspaceResolver } from "./workspace/active-workspace-resolver.js";
import { DrizzleActiveWorkspaceResolver } from "./workspace/drizzle-active-workspace-resolver.js";
import type { WorkspaceRepository } from "./workspace/workspace-repository.js";
import { DrizzleWorkspaceRepository } from "./workspace/drizzle-workspace-repository.js";
import type { WorkspaceMembersRepository } from "./workspace/workspace-members-repository.js";
import { DrizzleWorkspaceMembersRepository } from "./workspace/drizzle-workspace-members-repository.js";
import type { WorkspaceProvidersRepository } from "./workspace/workspace-providers-repository.js";
import { DrizzleWorkspaceProvidersRepository } from "./workspace/drizzle-workspace-providers-repository.js";
import type { WorkspaceTemplatesRepository } from "./workspace/workspace-templates-repository.js";
import { DrizzleWorkspaceTemplatesRepository } from "./workspace/drizzle-workspace-templates-repository.js";
import { DrizzleUsersRepository } from "./users/users-repo.js";
import {
  DefaultUsersService,
  type UsersService,
} from "./users/users-service.js";
import { ChatHandler } from "./chat-v2/chat-handler.js";

export interface AppContainer {
  config: Config;
  logger: Logger;
  chatGateway: ChatGatewayPort;
  userRepository: UserRepository;
  credentialsVerifier: CredentialsVerifier;
  authService: AuthService;
  jwtService: JwtService;
  auditEmitter: AuditEmitter;
  usersService: UsersService;
  orgUsersService: OrgUsersService;
  orgTemplateService: OrgTemplateService;
  orgProvidersService: OrgProvidersService;
  wsMembersService: WsMembersService;
  wsProvidersService: WsProvidersService;
  wsTemplatesService: WsTemplatesService;
  wsQuotasService: WsQuotasService;
  apiKeyVault: ApiKeyVault;
  bus: EventBus<ChatEvent>;
  registry: ConnectionRegistry;
  convRepo: ConversationRepository;
  msgRepo: MessageRepository;
  activeWorkspaceResolver: ActiveWorkspaceResolver;
  workspaceRepository: WorkspaceRepository;
  workspaceMembersRepository: WorkspaceMembersRepository;
  workspaceProvidersRepository: WorkspaceProvidersRepository;
  workspaceTemplatesRepository: WorkspaceTemplatesRepository;
  dbClient: DbClient;
  chatHandler: ChatHandler;
}

export async function buildContainer(
  config: Config,
  logger: Logger
): Promise<AppContainer> {
  // The user repository is always Postgres-backed, so a DB connection is required
  // to boot regardless of PERSISTENCE (which only selects conversation/message repos).
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const dbClient = createDbClient({ url: databaseUrl, poolMax: 10 });

  const apiKeyVault = new ApiKeyVault({
    PROVIDER_KEY_VAULT_KEY: config.PROVIDER_KEY_VAULT_KEY,
    NODE_ENV: config.NODE_ENV,
  });

  // Providers come from the database, not env vars: the gateway re-reads them
  // through this source once per TTL window, so admin changes apply live.
  const providerConfigSource = new DbProviderConfigSource(dbClient, apiKeyVault, logger);
  await warmUpProviderSource(providerConfigSource, logger);
  const gateway = new LLMGateway({
    source: providerConfigSource,
    refreshTtlMs: config.PROVIDER_REFRESH_TTL_MS,
    onSourceError: (error) =>
      logger.error({ error }, "Provider config refresh failed; serving the last loaded providers"),
  });
  const chatGateway: ChatGatewayPort = new LlmGatewayAdapter(gateway);

  const jwtService = new JwtService(config.JWT_SECRET, config.JWT_EXPIRES_IN);

  const userRepository = new DrizzleUserRepository(dbClient);
  const workspaceRepository = new DrizzleWorkspaceRepository(dbClient);
  const workspaceMembersRepository = new DrizzleWorkspaceMembersRepository(dbClient);
  const workspaceProvidersRepository = new DrizzleWorkspaceProvidersRepository(dbClient);
  const workspaceTemplatesRepository = new DrizzleWorkspaceTemplatesRepository(dbClient);
  const credentialsVerifier = new CredentialsVerifier(userRepository);
  const authService = new AuthService(
    credentialsVerifier,
    jwtService,
    userRepository,
    config.JWT_EXPIRES_IN
  );
  const auditEmitter = new StdoutAuditEmitter(logger);
  const usersRepo = new DrizzleUsersRepository(dbClient);
  const usersService = new DefaultUsersService(usersRepo);
  const orgUsersRepo = new InMemoryOrgUsersRepository(seedOrgUsers());
  const orgUsersService = new DefaultOrgUsersService(
    orgUsersRepo,
    auditEmitter,
    logger,
  );
  const orgTemplateRepo = new InMemoryOrgTemplateRepo();
  const orgTemplateService = new OrgTemplateService(orgTemplateRepo, auditEmitter);
  const orgProvidersRepo = new DrizzleProvidersRepository(dbClient);
  const orgProvidersService = new OrgProvidersService(
    orgProvidersRepo,
    apiKeyVault,
    auditEmitter,
    logger,
  );
  const wsMembersRepo = new InMemoryWsMembersRepository(seedWsMembers());
  const wsMembersService = new DefaultWsMembersService(
    wsMembersRepo,
    auditEmitter,
    logger,
  );
  const wsProviderBindingsRepo = new InMemoryWsProviderBindingsRepo();
  const wsProvidersService = new WsProvidersService(
    wsProviderBindingsRepo,
    orgProvidersRepo,
    auditEmitter,
    logger,
  );
  const wsTemplateBindingsRepo = new InMemoryWsTemplateBindingsRepo();
  const wsTemplatesService = new WsTemplatesService(
    wsTemplateBindingsRepo,
    orgTemplateRepo,
    auditEmitter,
    logger,
  );
  const wsQuotasRepo = new InMemoryWsQuotasRepo();
  const wsQuotasService = new WsQuotasService(
    wsQuotasRepo,
    new StubUsageCounter(),
    auditEmitter,
    logger,
  );

  const bus = new EventBus<ChatEvent>({ logger });
  const registry = new LocalConnectionRegistry();

  const persistence = process.env.PERSISTENCE ?? "in-memory";
  let convRepo: ConversationRepository;
  let msgRepo: MessageRepository;
  let activeWorkspaceResolver: ActiveWorkspaceResolver;

  if (persistence === "drizzle") {
    convRepo = new DrizzleConversationRepository(dbClient);
    msgRepo = new DrizzleMessageRepository(dbClient);
    activeWorkspaceResolver = new DrizzleActiveWorkspaceResolver(dbClient);
    if (config.NODE_ENV !== "production") {
      await seedDrizzleDevData(dbClient);
      await seedPromptTemplates(dbClient);
    }
  } else {
    const inMemoryConvRepo = new InMemoryConversationRepository();
    convRepo = inMemoryConvRepo;
    msgRepo = new InMemoryMessageRepository(inMemoryConvRepo);
    activeWorkspaceResolver = new InMemoryActiveWorkspaceResolver();
  }

  const chatHandler = new ChatHandler(bus, chatGateway, logger);
  chatHandler.start();

  return {
    config,
    logger,
    chatGateway,
    userRepository,
    credentialsVerifier,
    authService,
    jwtService,
    auditEmitter,
    usersService,
    orgUsersService,
    orgTemplateService,
    orgProvidersService,
    wsMembersService,
    wsProvidersService,
    wsTemplatesService,
    wsQuotasService,
    apiKeyVault,
    bus,
    registry,
    convRepo,
    msgRepo,
    activeWorkspaceResolver,
    workspaceRepository,
    workspaceMembersRepository,
    workspaceProvidersRepository,
    workspaceTemplatesRepository,
    dbClient,
    chatHandler,
  };
}

/**
 * Eagerly load the provider source once at boot so an empty providers table
 * or an unreachable database is visible in the logs immediately. Never fatal:
 * the gateway retries through its own TTL refresh on the first chat request.
 */
export async function warmUpProviderSource(
  source: ProviderConfigSource,
  logger: Logger
): Promise<void> {
  try {
    const initial = await source.load();
    if (Object.keys(initial).length === 0) {
      logger.warn(
        "No enabled LLM providers in the database - chat is unavailable until one is added"
      );
    }
  } catch (error) {
    logger.warn(
      { error },
      "Provider config could not be loaded at boot; the gateway retries on the first chat request"
    );
  }
}

function seedWsMembers(): Map<string, WsMemberRow[]> {
  return new Map([
    [
      "demo-ws",
      [
        {
          id: "seed-ws-admin",
          email: "ada@demo.example",
          role: "admin",
          joinedAt: "2026-01-15T09:00:00.000Z",
        },
      ],
    ],
  ]);
}

function seedOrgUsers(): Map<string, OrgUserRow[]> {
  return new Map([
    [
      "demo-org",
      [
        {
          id: "seed-user-active",
          email: "ada@demo.example",
          status: "active",
          joinedAt: "2026-01-15T09:00:00.000Z",
        },
      ],
    ],
  ]);
}
