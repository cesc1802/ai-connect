import type { Span, Tracer } from "@opentelemetry/api";
import type { ChatRequest, ChatResponse, TelemetryConfig, ProviderName } from "../core/index.js";

// Semantic conventions for LLM operations (GenAI spec)
const SEMANTIC_ATTR = {
  LLM_SYSTEM: "gen_ai.system",
  LLM_REQUEST_MODEL: "gen_ai.request.model",
  LLM_REQUEST_MAX_TOKENS: "gen_ai.request.max_tokens",
  LLM_REQUEST_TEMPERATURE: "gen_ai.request.temperature",
  LLM_RESPONSE_MODEL: "gen_ai.response.model",
  LLM_RESPONSE_FINISH_REASON: "gen_ai.response.finish_reasons",
  LLM_USAGE_INPUT_TOKENS: "gen_ai.usage.input_tokens",
  LLM_USAGE_OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
} as const;

/**
 * Span wrapper for LLM operations
 */
export interface LLMSpan {
  setRequestAttributes(request: ChatRequest, provider: ProviderName): void;
  setResponseAttributes(response: ChatResponse): void;
  recordError(error: Error): void;
  end(): void;
}

/**
 * No-op span when telemetry disabled
 */
class NoOpSpan implements LLMSpan {
  setRequestAttributes(): void {}
  setResponseAttributes(): void {}
  recordError(): void {}
  end(): void {}
}

/**
 * OpenTelemetry span wrapper
 */
class OTelSpan implements LLMSpan {
  constructor(private readonly span: Span) {}

  setRequestAttributes(request: ChatRequest, provider: ProviderName): void {
    this.span.setAttributes({
      [SEMANTIC_ATTR.LLM_SYSTEM]: provider,
      [SEMANTIC_ATTR.LLM_REQUEST_MODEL]: request.model,
      [SEMANTIC_ATTR.LLM_REQUEST_MAX_TOKENS]: request.maxTokens,
      ...(request.temperature !== undefined && {
        [SEMANTIC_ATTR.LLM_REQUEST_TEMPERATURE]: request.temperature,
      }),
      "llm.request.message_count": request.messages.length,
      "llm.request.has_tools": (request.tools?.length ?? 0) > 0,
    });
  }

  setResponseAttributes(response: ChatResponse): void {
    this.span.setAttributes({
      [SEMANTIC_ATTR.LLM_RESPONSE_MODEL]: response.model,
      [SEMANTIC_ATTR.LLM_RESPONSE_FINISH_REASON]: [response.finishReason],
      [SEMANTIC_ATTR.LLM_USAGE_INPUT_TOKENS]: response.usage.inputTokens,
      [SEMANTIC_ATTR.LLM_USAGE_OUTPUT_TOKENS]: response.usage.outputTokens,
      "llm.response.latency_ms": response.latencyMs,
      "llm.response.tool_calls_count": response.toolCalls.length,
    });
  }

  recordError(error: Error): void {
    this.span.recordException(error);
    this.span.setStatus({ code: 2, message: error.message }); // SpanStatusCode.ERROR = 2
  }

  end(): void {
    this.span.end();
  }
}

// Singleton no-op span for reuse
const NO_OP_SPAN = new NoOpSpan();

/**
 * LLM Tracer manages span creation for distributed tracing
 */
export class LLMTracer {
  private tracer: Tracer | null = null;
  private enabled: boolean;

  constructor(config?: TelemetryConfig) {
    this.enabled = config?.enabled ?? false;

    if (this.enabled) {
      this.initializeTracer(config);
    }
  }

  private initializeTracer(config?: TelemetryConfig): void {
    try {
      // Dynamic import to avoid hard dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const api = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
      this.tracer = api.trace.getTracer(
        config?.serviceName ?? "llm-gateway",
        config?.serviceVersion ?? "0.1.0"
      );
    } catch {
      // OpenTelemetry not installed, disable
      this.enabled = false;
      this.tracer = null;
    }
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.tracer !== null;
  }

  /**
   * Start a span for chat completion
   */
  startChatSpan(operationName: string = "llm.chat"): LLMSpan {
    if (!this.isEnabled() || !this.tracer) {
      return NO_OP_SPAN;
    }

    const span = this.tracer.startSpan(operationName, {
      kind: 3, // SpanKind.CLIENT = 3
    });

    return new OTelSpan(span);
  }

  /**
   * Start a span for streaming completion
   */
  startStreamSpan(operationName: string = "llm.stream"): LLMSpan {
    if (!this.isEnabled() || !this.tracer) {
      return NO_OP_SPAN;
    }

    const span = this.tracer.startSpan(operationName, {
      kind: 3, // SpanKind.CLIENT = 3
      attributes: {
        "llm.streaming": true,
      },
    });

    return new OTelSpan(span);
  }
}
