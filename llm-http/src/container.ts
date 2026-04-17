import { LLMGateway } from "llm-gateway";
import type { Config } from "./config.js";
import { extractProviderConfigs } from "./config.js";
import type { Logger } from "./logger.js";
import type { ChatGatewayPort } from "./chat/chat-gateway-port.js";
import { LlmGatewayAdapter } from "./chat/llm-gateway-adapter.js";
import { NullGatewayAdapter } from "./chat/null-gateway-adapter.js";

export interface AppContainer {
  config: Config;
  logger: Logger;
  chatGateway: ChatGatewayPort;
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

  return { config, logger, chatGateway };
}
