import type { ProviderName } from "./types.js";
import type { ProviderConfigSource } from "./provider-config-source.js";
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
  providers?: ProviderConfig;
  // Dynamic provider configuration source. Mutually exclusive with static
  // `providers`. In source mode env vars are NOT merged: the source is the
  // single authority, and an env merge would resurrect providers it removed.
  source?: ProviderConfigSource;
  // Source mode only: re-read the source after this many ms (refresh-on-use,
  // not a timer). Clamped to a 1s minimum.
  refreshTtlMs?: number;
  // Source mode only: invoked when a refresh fails after at least one
  // successful load. The gateway keeps serving the last good config.
  onSourceError?: (error: unknown) => void;
  defaultProvider?: ProviderName;
  timeoutMs?: number;
  // Per-chunk idle deadline for streaming. Resets each chunk; fires only if
  // no chunk arrives for this many ms. Covers slow time-to-first-token and
  // mid-stream stalls without killing legitimately long answers.
  streamIdleTimeoutMs?: number;
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
// Streaming idle gap. 5 minutes accommodates large-context cold starts and
// slow time-to-first-token without masking truly hung streams.
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;
export const DEFAULT_REFRESH_TTL_MS = 60_000;
export const MIN_REFRESH_TTL_MS = 1_000;

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
  if (minimaxKey) {
    const minimaxBaseUrl = process.env.MINIMAX_BASE_URL;
    config.minimax = {
      apiKey: minimaxKey,
      ...(minimaxBaseUrl && { baseUrl: minimaxBaseUrl }),
    };
  }

  return config;
}

/**
 * Merge configs with explicit config taking precedence over env
 */
export function mergeWithEnvConfig(
  config: GatewayConfig
): GatewayConfig & { providers: ProviderConfig } {
  const envConfig = loadConfigFromEnv();
  // Filter out undefined provider entries from explicit config
  const explicitProviders = Object.fromEntries(
    Object.entries(config.providers ?? {}).filter(([, v]) => v !== undefined)
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
  const { providers, source, defaultProvider } = config;

  const configuredProviders = providers
    ? Object.keys(providers).filter((k) => providers[k as keyof ProviderConfig] !== undefined)
    : [];

  if (source && configuredProviders.length > 0) {
    throw new ValidationError(
      "Configure either static 'providers' or a dynamic 'source', not both",
      "providers"
    );
  }

  // Source mode: providers arrive later, so zero at boot is valid and the
  // static checks below (including defaultProvider) do not apply.
  if (source) {
    return;
  }

  // Must have at least one provider
  if (!providers || configuredProviders.length === 0) {
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
  }
}
