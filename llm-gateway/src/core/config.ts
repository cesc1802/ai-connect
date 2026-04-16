import type { ProviderName } from "./types.js";
import { ValidationError } from "./errors.js";

/**
 * Provider-specific configuration
 */
export interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface OllamaConfig {
  baseUrl: string; // Required, no API key
  defaultModel?: string;
}

export interface MiniMaxConfig {
  apiKey: string;
  groupId: string;
  baseUrl?: string;
  defaultModel?: string;
}

export type ProviderConfig = {
  anthropic?: AnthropicConfig;
  openai?: OpenAIConfig;
  ollama?: OllamaConfig;
  minimax?: MiniMaxConfig;
};

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  resetTimeoutMs: number; // Time before half-open
  halfOpenRequests: number; // Requests to test in half-open
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // Error codes to retry
}

/**
 * Main gateway configuration
 */
export interface GatewayConfig {
  providers: ProviderConfig;
  defaultProvider?: ProviderName;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  telemetry?: TelemetryConfig;
}

export interface TelemetryConfig {
  enabled: boolean;
  serviceName?: string;
  serviceVersion?: string;
}

/**
 * Default configurations
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenRequests: 3,
};

export const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
  retryableErrors: ["TIMEOUT", "RATE_LIMIT", "PROVIDER_ERROR"],
};

/**
 * Load config from environment variables
 */
export function loadConfigFromEnv(): Partial<ProviderConfig> {
  const config: Partial<ProviderConfig> = {};

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
    config.anthropic = {
      apiKey: anthropicKey,
      ...(anthropicBaseUrl && { baseUrl: anthropicBaseUrl }),
    };
  }

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openaiOrg = process.env.OPENAI_ORG_ID;
    const openaiBaseUrl = process.env.OPENAI_BASE_URL;
    config.openai = {
      apiKey: openaiKey,
      ...(openaiOrg && { organization: openaiOrg }),
      ...(openaiBaseUrl && { baseUrl: openaiBaseUrl }),
    };
  }

  // Ollama
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  if (ollamaUrl) {
    config.ollama = {
      baseUrl: ollamaUrl,
    };
  }

  // MiniMax
  const minimaxKey = process.env.MINIMAX_API_KEY;
  const minimaxGroup = process.env.MINIMAX_GROUP_ID;
  if (minimaxKey && minimaxGroup) {
    const minimaxBaseUrl = process.env.MINIMAX_BASE_URL;
    config.minimax = {
      apiKey: minimaxKey,
      groupId: minimaxGroup,
      ...(minimaxBaseUrl && { baseUrl: minimaxBaseUrl }),
    };
  }

  return config;
}

/**
 * Merge configs with explicit config taking precedence over env
 */
export function mergeWithEnvConfig(config: GatewayConfig): GatewayConfig {
  const envConfig = loadConfigFromEnv();
  // Filter out undefined provider entries from explicit config
  const explicitProviders = Object.fromEntries(
    Object.entries(config.providers).filter(([, v]) => v !== undefined)
  ) as ProviderConfig;
  return {
    ...config,
    providers: {
      ...envConfig,
      ...explicitProviders,
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: GatewayConfig): void {
  const { providers, defaultProvider } = config;

  // Must have at least one provider
  const configuredProviders = Object.keys(providers).filter(
    (k) => providers[k as keyof ProviderConfig] !== undefined
  );
  if (configuredProviders.length === 0) {
    throw new ValidationError("At least one provider must be configured", "providers");
  }

  // Default provider must be configured
  if (defaultProvider && !providers[defaultProvider]) {
    throw new ValidationError(
      `Default provider '${defaultProvider}' is not configured`,
      "defaultProvider"
    );
  }

  // Validate Anthropic config
  if (providers.anthropic && !providers.anthropic.apiKey) {
    throw new ValidationError("Anthropic API key is required", "providers.anthropic.apiKey");
  }

  // Validate OpenAI config
  if (providers.openai && !providers.openai.apiKey) {
    throw new ValidationError("OpenAI API key is required", "providers.openai.apiKey");
  }

  // Validate Ollama config
  if (providers.ollama && !providers.ollama.baseUrl) {
    throw new ValidationError("Ollama base URL is required", "providers.ollama.baseUrl");
  }

  // Validate MiniMax config
  if (providers.minimax) {
    if (!providers.minimax.apiKey) {
      throw new ValidationError("MiniMax API key is required", "providers.minimax.apiKey");
    }
    if (!providers.minimax.groupId) {
      throw new ValidationError("MiniMax group ID is required", "providers.minimax.groupId");
    }
  }
}
