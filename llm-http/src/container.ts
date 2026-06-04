import { LLMGateway } from "llm-gateway";
import type { AuditEmitter } from "@ai-connect/shared";
import type { Config } from "./config.js";
import { extractProviderConfigs } from "./config.js";
import type { Logger } from "./logger.js";
import type { ChatGatewayPort } from "./chat/chat-gateway-port.js";
import { LlmGatewayAdapter } from "./chat/llm-gateway-adapter.js";
import { NullGatewayAdapter } from "./chat/null-gateway-adapter.js";
import type { UserRepository } from "./auth/user-repository.js";
import { InMemoryUserRepository } from "./auth/in-memory-user-repository.js";
import { seedUsers } from "./auth/seed-users.js";
import { CredentialsVerifier } from "./auth/credentials-verifier.js";
import { JwtService } from "./auth/jwt-service.js";
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
import { InMemoryProvidersRepository } from "./admin/org/providers-repo.js";
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
import { StreamChatUseCase } from "./chat/stream-chat-use-case.js";
import { OneShotChatUseCase } from "./chat/one-shot-chat-use-case.js";
import { ChatCommandHandler } from "./chat/handlers/chat-command-handler.js";
import { PingCommandHandler } from "./chat/handlers/ping-command-handler.js";
import type { WsCommandHandlerMap } from "./chat/chat-ws-handler.js";

export interface AppContainer {
  config: Config;
  logger: Logger;
  chatGateway: ChatGatewayPort;
  userRepository: UserRepository;
  credentialsVerifier: CredentialsVerifier;
  jwtService: JwtService;
  auditEmitter: AuditEmitter;
  orgUsersService: OrgUsersService;
  orgTemplateService: OrgTemplateService;
  orgProvidersService: OrgProvidersService;
  wsMembersService: WsMembersService;
  wsProvidersService: WsProvidersService;
  wsTemplatesService: WsTemplatesService;
  wsQuotasService: WsQuotasService;
  apiKeyVault: ApiKeyVault;
  streamChatUseCase: StreamChatUseCase;
  oneShotChatUseCase: OneShotChatUseCase;
  wsCommandHandlers: WsCommandHandlerMap;
}

export function buildContainer(config: Config, logger: Logger): AppContainer {
  const providers = extractProviderConfigs(config);
  const hasProviders = Object.keys(providers).length > 0;

  if (!hasProviders && config.NODE_ENV === "production") {
    throw new Error("At least one LLM provider must be configured in production");
  }

  let chatGateway: ChatGatewayPort;

  if (hasProviders) {
    const gateway = new LLMGateway({ providers });
    chatGateway = new LlmGatewayAdapter(gateway);
  } else {
    logger.warn("No LLM providers configured - chat functionality will be unavailable");
    chatGateway = new NullGatewayAdapter();
  }

  const userRepository = new InMemoryUserRepository(seedUsers(config.DEMO_USERS));
  const credentialsVerifier = new CredentialsVerifier(userRepository);
  const jwtService = new JwtService(config.JWT_SECRET, config.JWT_EXPIRES_IN);
  const auditEmitter = new StdoutAuditEmitter(logger);
  const orgUsersRepo = new InMemoryOrgUsersRepository(seedOrgUsers());
  const orgUsersService = new DefaultOrgUsersService(
    orgUsersRepo,
    auditEmitter,
    logger,
  );
  const orgTemplateRepo = new InMemoryOrgTemplateRepo();
  const orgTemplateService = new OrgTemplateService(orgTemplateRepo, auditEmitter);
  const apiKeyVault = new ApiKeyVault({
    PROVIDER_KEY_VAULT_KEY: config.PROVIDER_KEY_VAULT_KEY,
    NODE_ENV: config.NODE_ENV,
  });
  const orgProvidersRepo = new InMemoryProvidersRepository();
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

  const streamChatUseCase = new StreamChatUseCase(chatGateway);
  const oneShotChatUseCase = new OneShotChatUseCase(chatGateway);
  const chatCommandHandler = new ChatCommandHandler(streamChatUseCase);
  const pingCommandHandler = new PingCommandHandler();
  const wsCommandHandlers: WsCommandHandlerMap = {
    chat: chatCommandHandler,
    ping: pingCommandHandler,
  };

  return {
    config,
    logger,
    chatGateway,
    userRepository,
    credentialsVerifier,
    jwtService,
    auditEmitter,
    orgUsersService,
    orgTemplateService,
    orgProvidersService,
    wsMembersService,
    wsProvidersService,
    wsTemplatesService,
    wsQuotasService,
    apiKeyVault,
    streamChatUseCase,
    oneShotChatUseCase,
    wsCommandHandlers,
  };
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
        {
          id: "seed-ws-member",
          email: "grace@demo.example",
          role: "member",
          joinedAt: "2026-02-08T14:30:00.000Z",
        },
        {
          id: "seed-ws-viewer",
          email: "alan@demo.example",
          role: "viewer",
          joinedAt: "2026-03-01T10:00:00.000Z",
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
        {
          id: "seed-user-pending",
          email: "grace@demo.example",
          status: "pending",
          joinedAt: "2026-02-08T14:30:00.000Z",
        },
      ],
    ],
  ]);
}
