import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  GatewayConfig,
  ProviderName,
  CircuitBreakerConfig,
  RetryConfig,
} from "./core/index.js";
import {
  mergeWithEnvConfig,
  validateConfig,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_RETRY,
  PROVIDER_NAMES,
  TimeoutError,
} from "./core/index.js";
import type { LLMProvider } from "./providers/index.js";
import { ProviderFactory } from "./factory/index.js";
import { Router, RoundRobinStrategy } from "./routing/index.js";
import type { IRoutingStrategy } from "./routing/index.js";
import { CircuitBreaker, RetryDecorator, FallbackChain } from "./resilience/index.js";
import type { CircuitMetrics } from "./resilience/index.js";

/**
 * Gateway metrics for monitoring
 */
export interface GatewayMetrics {
  providers: {
    name: ProviderName;
    healthy: boolean;
    circuit: CircuitMetrics;
  }[];
  totalRequests: number;
  totalErrors: number;
  averageLatencyMs: number;
}

/**
 * Gateway options for request customization
 */
export interface GatewayRequestOptions {
  provider?: ProviderName;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * LLMGateway - Main entry point for the SDK
 *
 * Integrates providers, routing, and resilience patterns into a unified API.
 *
 * @example
 * ```typescript
 * const gateway = new LLMGateway({
 *   providers: {
 *     anthropic: { apiKey: "sk-..." },
 *     openai: { apiKey: "sk-..." },
 *   },
 *   defaultProvider: "anthropic",
 * });
 *
 * const response = await gateway.chat({
 *   model: "claude-sonnet-4-20250514",
 *   messages: [{ role: "user", content: "Hello!" }],
 *   maxTokens: 1024,
 * });
 * ```
 */
export class LLMGateway {
  private readonly factory: ProviderFactory;
  private readonly router: Router;
  private readonly circuitBreakers = new Map<ProviderName, CircuitBreaker>();
  private readonly retryConfig: RetryConfig;
  private readonly timeoutMs: number;

  // Metrics tracking
  private totalRequests = 0;
  private totalErrors = 0;
  // Circular buffer for latencies - O(1) insertion
  private latencies: number[] = [];
  private latencyIndex = 0;
  private latencyCount = 0;
  private static readonly MAX_LATENCY_SAMPLES = 1000;

  constructor(config: GatewayConfig) {
    // Merge with env config and validate
    const mergedConfig = mergeWithEnvConfig(config);
    validateConfig(mergedConfig);

    // Store configs
    this.retryConfig = { ...DEFAULT_RETRY, ...config.retry };
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Create factory
    this.factory = new ProviderFactory(mergedConfig.providers);

    // Create providers and wrap with circuit breakers
    const cbConfig: CircuitBreakerConfig = {
      ...DEFAULT_CIRCUIT_BREAKER,
      ...config.circuitBreaker,
    };

    const providers = new Map<ProviderName, LLMProvider>();

    for (const name of PROVIDER_NAMES) {
      if (mergedConfig.providers[name]) {
        try {
          const rawProvider = this.factory.create(name);
          const circuitBreaker = new CircuitBreaker(rawProvider, cbConfig);
          this.circuitBreakers.set(name, circuitBreaker);
          providers.set(name, circuitBreaker);
        } catch {
          // Provider not registered or config error, skip
        }
      }
    }

    // Create router with default strategy
    const strategy: IRoutingStrategy = new RoundRobinStrategy();
    this.router = new Router(
      mergedConfig.defaultProvider
        ? { strategy, defaultProvider: mergedConfig.defaultProvider }
        : { strategy }
    );
    this.router.registerAll(providers);
  }

  /**
   * Execute a chat completion request
   */
  async chat(request: ChatRequest, options?: GatewayRequestOptions): Promise<ChatResponse> {
    this.totalRequests++;

    const provider = this.resolveProvider(request, options);
    const { signal, cleanup } = this.createTimeoutSignal(options);

    try {
      const response = await new RetryDecorator(provider, this.retryConfig).chatCompletion(
        request,
        signal
      );

      this.recordLatency(response.latencyMs);
      this.updateCircuitHealth(provider.name, true);
      return response;
    } catch (error) {
      this.totalErrors++;
      this.updateCircuitHealth(provider.name, false);
      throw error;
    } finally {
      cleanup();
    }
  }

  /**
   * Execute a streaming chat completion request
   */
  async *stream(
    request: ChatRequest,
    options?: GatewayRequestOptions
  ): AsyncIterable<StreamChunk> {
    this.totalRequests++;

    const provider = this.resolveProvider(request, options);
    const { signal, cleanup } = this.createTimeoutSignal(options);

    const startTime = performance.now();

    try {
      const retryProvider = new RetryDecorator(provider, this.retryConfig);

      for await (const chunk of retryProvider.streamCompletion(request, signal)) {
        yield chunk;
      }

      const latency = Math.round(performance.now() - startTime);
      this.recordLatency(latency);
      this.updateCircuitHealth(provider.name, true);
    } catch (error) {
      this.totalErrors++;
      this.updateCircuitHealth(provider.name, false);
      throw error;
    } finally {
      cleanup();
    }
  }

  /**
   * Get a specific provider by name (wrapped with circuit breaker)
   */
  getProvider(name: ProviderName): LLMProvider | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * Get all configured provider names
   */
  getProviderNames(): ProviderName[] {
    return Array.from(this.circuitBreakers.keys());
  }

  /**
   * Check if a provider is healthy
   */
  isProviderHealthy(name: ProviderName): boolean {
    return this.router.isHealthy(name);
  }

  /**
   * Get gateway metrics
   */
  getMetrics(): GatewayMetrics {
    const providers = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
      name,
      healthy: this.router.isHealthy(name),
      circuit: cb.getMetrics(),
    }));

    const avgLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0;

    return {
      providers,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      averageLatencyMs: Math.round(avgLatency),
    };
  }

  /**
   * Create a fallback chain for multiple providers
   */
  createFallbackChain(providers: ProviderName[]): FallbackChain {
    const chain = providers
      .map((name) => this.circuitBreakers.get(name))
      .filter((p): p is CircuitBreaker => p !== undefined);

    if (chain.length === 0) {
      throw new Error("No valid providers for fallback chain");
    }

    return new FallbackChain(chain);
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    await this.factory.disposeAll();
    this.circuitBreakers.clear();
    this.latencies = [];
    this.latencyIndex = 0;
    this.latencyCount = 0;
  }

  /**
   * Resolve which provider to use for request
   */
  private resolveProvider(request: ChatRequest, options?: GatewayRequestOptions): LLMProvider {
    // Explicit provider option takes priority
    if (options?.provider) {
      const provider = this.circuitBreakers.get(options.provider);
      if (provider) {
        return provider;
      }
    }

    // Use router for selection
    return this.router.selectProvider(request);
  }

  /**
   * Create timeout signal with cleanup function to prevent timer leaks.
   * Combines with user-provided signal if present.
   */
  private createTimeoutSignal(options?: GatewayRequestOptions): {
    signal: AbortSignal;
    cleanup: () => void;
  } {
    const timeout = options?.timeout ?? this.timeoutMs;

    // Combine with user signal if provided
    if (options?.signal) {
      const controller = new AbortController();
      const userSignal = options.signal;

      const timeoutId = setTimeout(() => {
        controller.abort(new TimeoutError("gateway", timeout));
      }, timeout);

      const abortHandler = () => {
        clearTimeout(timeoutId);
        controller.abort(userSignal.reason);
      };

      userSignal.addEventListener("abort", abortHandler);

      return {
        signal: controller.signal,
        cleanup: () => {
          clearTimeout(timeoutId);
          userSignal.removeEventListener("abort", abortHandler);
        },
      };
    }

    // Simple timeout signal without user signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new TimeoutError("gateway", timeout));
    }, timeout);

    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(timeoutId),
    };
  }

  /**
   * Update circuit health based on result
   */
  private updateCircuitHealth(name: ProviderName, healthy: boolean): void {
    if (!healthy) {
      const cb = this.circuitBreakers.get(name);
      if (cb) {
        const metrics = cb.getMetrics();
        if (metrics.state === "open") {
          this.router.markUnhealthy(name);
        }
      }
    } else {
      this.router.markHealthy(name);
    }
  }

  /**
   * Record latency for metrics using circular buffer (O(1) insertion)
   */
  private recordLatency(ms: number): void {
    if (this.latencyCount < LLMGateway.MAX_LATENCY_SAMPLES) {
      // Buffer not full yet, append
      this.latencies.push(ms);
      this.latencyCount++;
    } else {
      // Buffer full, overwrite oldest entry
      this.latencies[this.latencyIndex] = ms;
    }
    this.latencyIndex = (this.latencyIndex + 1) % LLMGateway.MAX_LATENCY_SAMPLES;
  }
}

/**
 * Create gateway with config - convenience function
 */
export function createGateway(config: GatewayConfig): LLMGateway {
  return new LLMGateway(config);
}
