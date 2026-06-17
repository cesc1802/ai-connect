import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  GatewayConfig,
  ProviderConfig,
  ProviderConfigSource,
  ProviderName,
  CircuitBreakerConfig,
  RetryConfig,
} from "./core/index.js";
import {
  mergeWithEnvConfig,
  validateConfig,
  stableStringify,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_REFRESH_TTL_MS,
  MIN_REFRESH_TTL_MS,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_RETRY,
  PROVIDER_NAMES,
  TimeoutError,
  AbortError,
  LLMError,
} from "./core/index.js";
import type { LLMProvider } from "./providers/index.js";
import { ProviderFactory } from "./factory/index.js";
// Imported from the module, not the barrel: tests mock the factory barrel
// with only ProviderFactory defined.
import { instantiateProvider } from "./factory/provider-factory.js";
// Side-effect import to register all providers with the factory
import "./init.js";
import { Router, RoundRobinStrategy } from "./routing/index.js";
import type { IRoutingStrategy } from "./routing/index.js";
import { CircuitBreaker, RetryDecorator, FallbackChain } from "./resilience/index.js";
import type { CircuitMetrics } from "./resilience/index.js";
import { LLMTracer, LLMMetrics } from "./telemetry/index.js";

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
 * A displaced provider instance waiting out its disposal delay so in-flight
 * streams that still hold it can finish.
 */
interface PendingDispose {
  provider: LLMProvider;
  timer: ReturnType<typeof setTimeout>;
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
  // Raw (unwrapped) instances — the gateway owns their disposal.
  private readonly rawProviders = new Map<ProviderName, LLMProvider>();
  private readonly circuitBreakerConfig: CircuitBreakerConfig;
  private readonly retryConfig: RetryConfig;
  private readonly timeoutMs: number;
  private readonly streamIdleTimeoutMs: number;

  // Dynamic source mode (undefined in static-config mode)
  private readonly source: ProviderConfigSource | undefined;
  private readonly refreshTtlMs: number;
  private readonly onSourceError: ((error: unknown) => void) | undefined;
  private lastLoadedAt = 0;
  private hasLoadedOnce = false;
  private refreshInFlight: Promise<void> | null = null;
  // Stable-serialized config per provider, for change detection across refreshes.
  private readonly activeConfigs = new Map<ProviderName, string>();
  // Displaced instances awaiting deferred disposal.
  private readonly pendingDisposes = new Set<PendingDispose>();
  // Set by dispose(); a refresh resolving afterwards must not repopulate
  // the registry of a torn-down gateway.
  private disposed = false;

  // Telemetry
  private readonly tracer: LLMTracer;
  private readonly metrics: LLMMetrics;

  // Metrics tracking
  private totalRequests = 0;
  private totalErrors = 0;
  // Circular buffer for latencies - O(1) insertion
  private latencies: number[] = [];
  private latencyIndex = 0;
  private latencyCount = 0;
  private static readonly MAX_LATENCY_SAMPLES = 1000;

  constructor(config: GatewayConfig) {
    // Source mode skips the env merge: the source is the single authority,
    // and merging env vars would resurrect providers it removed.
    const mergedConfig = config.source ? config : mergeWithEnvConfig(config);
    validateConfig(mergedConfig);

    // Store configs
    this.retryConfig = { ...DEFAULT_RETRY, ...config.retry };
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    this.source = config.source;
    // Number.isFinite rejects NaN/Infinity, which would slip past the clamp.
    this.refreshTtlMs = Number.isFinite(config.refreshTtlMs)
      ? Math.max(MIN_REFRESH_TTL_MS, config.refreshTtlMs as number)
      : DEFAULT_REFRESH_TTL_MS;
    this.onSourceError = config.onSourceError;

    // Initialize telemetry
    this.tracer = new LLMTracer(config.telemetry);
    this.metrics = new LLMMetrics(config.telemetry);

    // Create factory
    this.factory = new ProviderFactory(mergedConfig.providers ?? {});

    this.circuitBreakerConfig = {
      ...DEFAULT_CIRCUIT_BREAKER,
      ...config.circuitBreaker,
    };

    // Create router with default strategy (before providers, so
    // registerProvider can route-register each one as it is created)
    const strategy: IRoutingStrategy = new RoundRobinStrategy();
    this.router = new Router(
      mergedConfig.defaultProvider
        ? { strategy, defaultProvider: mergedConfig.defaultProvider }
        : { strategy }
    );

    // Create providers and wrap with circuit breakers (static mode; source
    // mode starts empty and loads on first request)
    const staticProviders = mergedConfig.providers ?? {};
    for (const name of PROVIDER_NAMES) {
      if (staticProviders[name]) {
        try {
          this.registerProvider(name, this.factory.create(name));
        } catch {
          // Provider not registered or config error, skip
        }
      }
    }
  }

  /**
   * Add a provider to the registry: wrap with a circuit breaker and make it
   * routable. Replaces any existing registration under the same name.
   */
  private registerProvider(name: ProviderName, provider: LLMProvider): void {
    const circuitBreaker = new CircuitBreaker(provider, this.circuitBreakerConfig);
    this.rawProviders.set(name, provider);
    this.circuitBreakers.set(name, circuitBreaker);
    this.router.register(name, circuitBreaker);
  }

  /**
   * Remove a provider from the registry and routing. Does NOT dispose the
   * instance: it may still be serving in-flight requests — callers own the
   * disposal policy.
   */
  private unregisterProvider(name: ProviderName): void {
    this.router.unregister(name);
    this.circuitBreakers.delete(name);
    this.rawProviders.delete(name);
  }

  /**
   * Source mode: re-sync the provider registry once the TTL has lapsed.
   * Single-flight — concurrent requests share one load() no matter how many
   * arrive while a refresh is running.
   */
  private async ensureFresh(): Promise<void> {
    if (this.hasLoadedOnce && Date.now() - this.lastLoadedAt < this.refreshTtlMs) {
      return;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshFromSource().finally(() => {
        this.refreshInFlight = null;
      });
    }
    await this.refreshInFlight;
  }

  private async refreshFromSource(): Promise<void> {
    if (!this.source || this.disposed) return;
    try {
      const loaded = await this.source.load();
      // Shutdown may have raced the load; don't repopulate a disposed gateway.
      if (this.disposed) return;
      this.applyLoadedConfig(loaded);
      this.hasLoadedOnce = true;
      this.lastLoadedAt = Date.now();
    } catch (error) {
      if (!this.hasLoadedOnce) {
        throw new LLMError(
          "Failed to load provider configuration from source",
          "CONFIG_SOURCE_ERROR",
          error instanceof Error ? error : new Error(String(error))
        );
      }
      // Keep serving the last good config. Stamp the load time so a down
      // source is retried once per TTL window, not on every request.
      this.lastLoadedAt = Date.now();
      this.onSourceError?.(error);
    }
  }

  /**
   * Reconcile the running registry with a freshly loaded config. Unchanged
   * providers keep their instance and circuit-breaker state; new ones are
   * registered; changed ones are swapped in immediately while the displaced
   * instance is disposed only after in-flight streams have had time to finish.
   */
  private applyLoadedConfig(loaded: ProviderConfig): void {
    // Two-phase apply: instantiate every new/changed provider before touching
    // the registry, so one failing constructor cannot leave a half-applied
    // mix of old and new configs.
    const swaps: { name: ProviderName; provider: LLMProvider; serialized: string }[] = [];
    const removals: ProviderName[] = [];
    try {
      for (const name of PROVIDER_NAMES) {
        const cfg = loaded[name];
        if (cfg) {
          const serialized = stableStringify(cfg);
          if (serialized === this.activeConfigs.get(name)) continue;
          swaps.push({ name, provider: instantiateProvider(name, cfg), serialized });
        } else if (this.activeConfigs.has(name)) {
          removals.push(name);
        }
      }
    } catch (error) {
      // Roll back: instances built for the aborted apply were never registered.
      for (const { provider } of swaps) {
        void provider.dispose();
      }
      throw error;
    }

    for (const { name, provider, serialized } of swaps) {
      const displaced = this.rawProviders.get(name);
      this.registerProvider(name, provider);
      this.activeConfigs.set(name, serialized);
      if (displaced) this.deferDispose(displaced);
    }
    for (const name of removals) {
      const displaced = this.rawProviders.get(name);
      this.unregisterProvider(name);
      this.activeConfigs.delete(name);
      if (displaced) this.deferDispose(displaced);
    }
  }

  /**
   * Dispose a displaced instance only after streamIdleTimeoutMs: streams
   * started before a swap hold the old reference, and their idle timeout
   * bounds how long they can possibly stay alive.
   */
  private deferDispose(provider: LLMProvider): void {
    const entry: PendingDispose = {
      provider,
      timer: setTimeout(() => {
        this.pendingDisposes.delete(entry);
        void provider.dispose();
      }, this.streamIdleTimeoutMs),
    };
    // Don't let a pending disposal pin the process open.
    entry.timer.unref?.();
    this.pendingDisposes.add(entry);
  }

  /**
   * Execute a chat completion request
   */
  async chat(request: ChatRequest, options?: GatewayRequestOptions): Promise<ChatResponse> {
    this.totalRequests++;

    // Sync guard keeps static mode free of any async hop.
    if (this.source) {
      await this.ensureFresh();
    }

    const provider = this.resolveProvider(request, options);
    // Normalize model name by stripping provider prefix (e.g., "minimax/MiniMax-M2.7" -> "MiniMax-M2.7")
    const normalizedRequest = this.normalizeRequest(request);
    const { signal, cleanup } = this.createTimeoutSignal(options);

    // Start telemetry span
    this.metrics.recordRequest(provider.name, normalizedRequest.model, false);
    const span = this.tracer.startChatSpan();
    span.setRequestAttributes(normalizedRequest, provider.name);

    try {
      const response = await new RetryDecorator(provider, this.retryConfig).chatCompletion(
        normalizedRequest,
        signal
      );

      span.setResponseAttributes(response);
      this.recordLatency(response.latencyMs);
      this.metrics.recordLatency(provider.name, response.model, response.latencyMs);
      this.metrics.recordTokens(
        provider.name,
        response.model,
        response.usage.inputTokens,
        response.usage.outputTokens
      );
      this.updateCircuitHealth(provider.name, true);
      return response;
    } catch (error) {
      this.totalErrors++;
      span.recordError(error instanceof Error ? error : new Error(String(error)));
      this.metrics.recordError(
        provider.name,
        error instanceof LLMError ? error.code : "UNKNOWN"
      );
      // Only blame the provider for provider-side faults.
      // Gateway-imposed timeouts and client aborts are not provider failures
      // and must not trip the circuit breaker.
      if (this.isProviderFault(error, options?.signal)) {
        this.updateCircuitHealth(provider.name, false);
      }
      throw error;
    } finally {
      span.end();
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

    // Sync guard keeps static mode free of any async hop.
    if (this.source) {
      await this.ensureFresh();
    }

    const provider = this.resolveProvider(request, options);
    // Normalize model name by stripping provider prefix (e.g., "minimax/MiniMax-M2.7" -> "MiniMax-M2.7")
    const normalizedRequest = this.normalizeRequest(request);
    // Streaming uses an idle timeout (reset on each chunk) instead of a
    // wall-clock deadline, so long answers complete as long as the provider
    // keeps emitting chunks. A truly stalled stream still aborts.
    const { signal, cleanup, reset } = this.createIdleTimeoutSignal(options);

    // Start telemetry span
    this.metrics.recordRequest(provider.name, normalizedRequest.model, true);
    const span = this.tracer.startStreamSpan();
    span.setRequestAttributes(normalizedRequest, provider.name);

    const startTime = performance.now();

    try {
      const retryProvider = new RetryDecorator(provider, this.retryConfig);

      for await (const chunk of retryProvider.streamCompletion(normalizedRequest, signal)) {
        reset();
        // Stamp the resolved provider kind on the terminal chunk (the one
        // carrying usage/finishReason) so downstream usage capture attributes
        // tokens to the provider that actually served the turn, not the model
        // prefix (which routing/fallback can diverge from).
        if (chunk.finishReason || chunk.usage) {
          yield { ...chunk, provider: provider.name };
        } else {
          yield chunk;
        }
      }

      const latency = Math.round(performance.now() - startTime);
      this.recordLatency(latency);
      this.metrics.recordLatency(provider.name, normalizedRequest.model, latency);
      this.updateCircuitHealth(provider.name, true);
    } catch (error) {
      this.totalErrors++;
      span.recordError(error instanceof Error ? error : new Error(String(error)));
      this.metrics.recordError(
        provider.name,
        error instanceof LLMError ? error.code : "UNKNOWN"
      );
      if (this.isProviderFault(error, options?.signal)) {
        this.updateCircuitHealth(provider.name, false);
      }
      throw error;
    } finally {
      span.end();
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
   * Dispose all resources. The gateway's own registry is the source of truth
   * for disposal: instances may be created outside the factory's cache.
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    // Flush deferred disposals now instead of waiting for their timers.
    const pending = Array.from(this.pendingDisposes);
    this.pendingDisposes.clear();
    for (const entry of pending) {
      clearTimeout(entry.timer);
    }

    const instances = [
      ...Array.from(this.rawProviders.values()),
      ...pending.map((entry) => entry.provider),
    ];
    // allSettled so one failing dispose cannot leak the others.
    const results = await Promise.allSettled(instances.map((p) => p.dispose()));

    for (const name of Array.from(this.rawProviders.keys())) {
      this.unregisterProvider(name);
    }
    this.activeConfigs.clear();
    this.latencies = [];
    this.latencyIndex = 0;
    this.latencyCount = 0;

    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failure) {
      throw failure.reason;
    }
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
   * Create an idle-reset timeout signal for streaming.
   * The timer fires only after `timeout` ms of inactivity (no chunks).
   * Caller invokes `reset()` after each chunk to defer the deadline.
   */
  private createIdleTimeoutSignal(options?: GatewayRequestOptions): {
    signal: AbortSignal;
    cleanup: () => void;
    reset: () => void;
  } {
    // Streaming uses streamIdleTimeoutMs (default 5 min). The 60s `timeoutMs`
    // is tuned for non-streaming chat() and is too tight for time-to-first-
    // token on large prompts.
    const timeout = options?.timeout ?? this.streamIdleTimeoutMs;
    const controller = new AbortController();

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      controller.abort(new TimeoutError("gateway", timeout));
    }, timeout);

    const reset = (): void => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        controller.abort(new TimeoutError("gateway", timeout));
      }, timeout);
    };

    const userSignal = options?.signal;
    let abortHandler: (() => void) | null = null;
    if (userSignal) {
      abortHandler = () => controller.abort(userSignal.reason);
      if (userSignal.aborted) {
        abortHandler();
      } else {
        userSignal.addEventListener("abort", abortHandler);
      }
    }

    return {
      signal: controller.signal,
      reset,
      cleanup: () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (userSignal && abortHandler) {
          userSignal.removeEventListener("abort", abortHandler);
        }
      },
    };
  }

  /**
   * True when an error reflects a real provider-side fault.
   * Gateway-imposed timeouts and client/user aborts are NOT provider faults
   * and must not contribute to circuit-breaker failure counts.
   * If the caller's signal is aborted, treat the failure as a client cancel
   * regardless of the surfaced error shape (providers normalize aborts
   * inconsistently — some throw plain Error, others throw DOMException).
   */
  private isProviderFault(error: unknown, userSignal?: AbortSignal): boolean {
    if (userSignal?.aborted) return false;
    if (error instanceof TimeoutError) return false;
    if (error instanceof AbortError) return false;
    if (error instanceof Error && error.name === "AbortError") return false;
    return true;
  }

  /**
   * Normalize request by stripping provider prefix from model name
   * e.g., "minimax/MiniMax-M2.7" -> "MiniMax-M2.7"
   */
  private normalizeRequest(request: ChatRequest): ChatRequest {
    const parts = request.model.split("/");
    if (parts.length >= 2 && PROVIDER_NAMES.includes(parts[0] as ProviderName)) {
      return { ...request, model: parts.slice(1).join("/") };
    }
    return request;
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
