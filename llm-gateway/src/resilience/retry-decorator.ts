import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderName,
  RetryConfig,
} from "../core/index.js";
import { DEFAULT_RETRY, LLMError } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";

/**
 * Retry event for logging/telemetry
 */
export interface RetryEvent {
  attempt: number;
  maxAttempts: number;
  error: Error;
  delayMs: number;
  willRetry: boolean;
}

/**
 * Retry event listener
 */
export type RetryEventListener = (event: RetryEvent) => void;

/**
 * Retry decorator adds retry logic with exponential backoff
 */
export class RetryDecorator implements LLMProvider {
  readonly name: ProviderName;
  readonly models: string[];

  private readonly config: RetryConfig;
  private readonly listeners: RetryEventListener[] = [];

  constructor(
    private readonly provider: LLMProvider,
    config?: Partial<RetryConfig>
  ) {
    this.name = provider.name;
    this.models = provider.models;
    this.config = { ...DEFAULT_RETRY, ...config };
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
   * Add a retry event listener
   */
  onRetry(listener: RetryEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a retry event listener
   */
  offRetry(listener: RetryEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  async chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.provider.chatCompletion(request, signal);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const canRetry = attempt < this.config.maxRetries && this.shouldRetry(lastError);
        if (canRetry) {
          const delay = this.calculateDelay(attempt);
          this.emitRetryEvent(attempt + 1, lastError, delay, true);
          await this.sleep(delay, signal);
        } else {
          this.emitRetryEvent(attempt + 1, lastError, 0, false);
          break; // Exit loop when not retrying
        }
      }
    }

    throw lastError;
  }

  async *streamCompletion(
    request: ChatRequest,
    signal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const stream = this.provider.streamCompletion(request, signal);

        for await (const chunk of stream) {
          yield chunk;
        }

        // If we get here without error, return
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const canRetry = attempt < this.config.maxRetries && this.shouldRetry(lastError);
        if (canRetry) {
          const delay = this.calculateDelay(attempt);
          this.emitRetryEvent(attempt + 1, lastError, delay, true);
          await this.sleep(delay, signal);
        } else {
          this.emitRetryEvent(attempt + 1, lastError, 0, false);
          break; // Exit loop when not retrying
        }
      }
    }

    throw lastError;
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(error: Error): boolean {
    // Check abort
    if (error.name === "AbortError") {
      return false;
    }

    // Check error code
    if (error instanceof LLMError) {
      return this.config.retryableErrors.includes(error.code);
    }

    // Network errors are generally retryable
    if (error.message.includes("ECONNRESET") || error.message.includes("ETIMEDOUT")) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for attempt using exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    // Add jitter (10% random variation)
    const jitter = delay * 0.1 * Math.random();
    return Math.min(delay + jitter, this.config.maxDelayMs);
  }

  /**
   * Sleep for duration, respecting abort signal
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error(signal?.reason ?? "Aborted"));
      };

      const timeout = setTimeout(() => {
        signal?.removeEventListener("abort", abortHandler);
        resolve();
      }, ms);

      signal?.addEventListener("abort", abortHandler, { once: true });
    });
  }

  /**
   * Emit retry event to listeners
   */
  private emitRetryEvent(
    attempt: number,
    error: Error,
    delayMs: number,
    willRetry: boolean
  ): void {
    const event: RetryEvent = {
      attempt,
      maxAttempts: this.config.maxRetries + 1,
      error,
      delayMs,
      willRetry,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
