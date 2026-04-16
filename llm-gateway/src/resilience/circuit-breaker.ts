import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderName,
  CircuitBreakerConfig,
} from "../core/index.js";
import { CircuitOpenError, DEFAULT_CIRCUIT_BREAKER } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

/**
 * Circuit breaker metrics
 */
export interface CircuitMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | undefined;
  lastSuccess: Date | undefined;
  openedAt: Date | undefined;
}

/**
 * Circuit breaker decorator wraps a provider with circuit breaker logic
 */
export class CircuitBreaker implements LLMProvider {
  readonly name: ProviderName;
  readonly models: string[];

  private state = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private halfOpenRequests = 0;
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private openedAt?: Date;

  private readonly config: CircuitBreakerConfig;

  constructor(
    private readonly provider: LLMProvider,
    config?: Partial<CircuitBreakerConfig>
  ) {
    this.name = provider.name;
    this.models = provider.models;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER, ...config };
  }

  capabilities(): ProviderCapabilities {
    return this.provider.capabilities();
  }

  supportsModel(model: string): boolean {
    return this.provider.supportsModel(model);
  }

  async dispose(): Promise<void> {
    return this.provider.dispose();
  }

  /**
   * Get current circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
    };
  }

  /**
   * Force circuit to open state (for testing/manual override)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.openedAt = new Date();
  }

  /**
   * Force circuit to closed state (for testing/manual reset)
   */
  forceClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenRequests = 0;
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    this.checkState();

    try {
      const response = await this.provider.chatCompletion(request, signal);
      this.recordSuccess();
      return response;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async *streamCompletion(
    request: ChatRequest,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    this.checkState();

    try {
      const stream = this.provider.streamCompletion(request, signal);
      let hasYielded = false;

      for await (const chunk of stream) {
        hasYielded = true;
        yield chunk;
      }

      // Only record success if we got at least one chunk
      if (hasYielded) {
        this.recordSuccess();
      }
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  private checkState(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        return; // Allow request

      case CircuitState.OPEN:
        // Check if timeout has elapsed
        if (this.openedAt) {
          const elapsed = Date.now() - this.openedAt.getTime();
          if (elapsed >= this.config.resetTimeoutMs) {
            // Transition to half-open
            this.state = CircuitState.HALF_OPEN;
            this.halfOpenRequests = 0;
            return; // Allow request
          }
        }
        throw new CircuitOpenError(this.name, this.openedAt ?? new Date());

      case CircuitState.HALF_OPEN:
        // Allow limited requests
        if (this.halfOpenRequests >= this.config.halfOpenRequests) {
          throw new CircuitOpenError(this.name, this.openedAt ?? new Date());
        }
        this.halfOpenRequests++;
        return;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    this.successes++;
    this.lastSuccess = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Successful request in half-open, close circuit
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.halfOpenRequests = 0;
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open, reopen circuit
      this.state = CircuitState.OPEN;
      this.openedAt = new Date();
      this.halfOpenRequests = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open
      if (this.failures >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.openedAt = new Date();
      }
    }
  }
}
