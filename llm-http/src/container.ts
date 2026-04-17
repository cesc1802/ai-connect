import { LLMGateway } from "llm-gateway";
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

export interface AppContainer {
  config: Config;
  logger: Logger;
  chatGateway: ChatGatewayPort;
  userRepository: UserRepository;
  credentialsVerifier: CredentialsVerifier;
  jwtService: JwtService;
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

  return { config, logger, chatGateway, userRepository, credentialsVerifier, jwtService };
}
