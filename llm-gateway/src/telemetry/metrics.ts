import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import type { TelemetryConfig, ProviderName } from "../core/index.js";

/**
 * LLM Metrics collector for request counting, error tracking, and latency histograms
 */
export class LLMMetrics {
  private meter: Meter | null = null;
  private enabled: boolean;

  // Metrics instruments
  private requestCounter: Counter | null = null;
  private errorCounter: Counter | null = null;
  private latencyHistogram: Histogram | null = null;
  private tokenCounter: Counter | null = null;

  constructor(config?: TelemetryConfig) {
    this.enabled = config?.enabled ?? false;

    if (this.enabled) {
      this.initializeMetrics(config);
    }
  }

  private initializeMetrics(config?: TelemetryConfig): void {
    try {
      // Dynamic import to avoid hard dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const api = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
      this.meter = api.metrics.getMeter(
        config?.serviceName ?? "llm-gateway",
        config?.serviceVersion ?? "0.1.0"
      );

      // Create metrics instruments
      this.requestCounter = this.meter.createCounter("llm.requests", {
        description: "Total number of LLM requests",
      });

      this.errorCounter = this.meter.createCounter("llm.errors", {
        description: "Total number of LLM errors",
      });

      this.latencyHistogram = this.meter.createHistogram("llm.latency", {
        description: "LLM request latency in milliseconds",
        unit: "ms",
      });

      this.tokenCounter = this.meter.createCounter("llm.tokens", {
        description: "Total tokens used",
      });
    } catch {
      // OpenTelemetry not installed, disable
      this.enabled = false;
    }
  }

  /**
   * Check if metrics are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a request
   */
  recordRequest(provider: ProviderName, model: string, streaming: boolean): void {
    if (!this.enabled || !this.requestCounter) return;

    this.requestCounter.add(1, {
      provider,
      model,
      streaming: String(streaming),
    });
  }

  /**
   * Record an error
   */
  recordError(provider: ProviderName, errorCode: string): void {
    if (!this.enabled || !this.errorCounter) return;

    this.errorCounter.add(1, {
      provider,
      error_code: errorCode,
    });
  }

  /**
   * Record latency
   */
  recordLatency(provider: ProviderName, model: string, latencyMs: number): void {
    if (!this.enabled || !this.latencyHistogram) return;

    this.latencyHistogram.record(latencyMs, {
      provider,
      model,
    });
  }

  /**
   * Record token usage
   */
  recordTokens(
    provider: ProviderName,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    if (!this.enabled || !this.tokenCounter) return;

    this.tokenCounter.add(inputTokens, {
      provider,
      model,
      type: "input",
    });

    this.tokenCounter.add(outputTokens, {
      provider,
      model,
      type: "output",
    });
  }
}
