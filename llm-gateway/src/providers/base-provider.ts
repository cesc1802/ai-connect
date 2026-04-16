import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderName,
  ChatMessage,
  ContentBlock,
} from "../core/index.js";
import { ValidationError, AbortError } from "../core/index.js";
import type { LLMProvider } from "./llm-provider.js";

/**
 * Abstract base class providing common functionality for providers
 */
export abstract class BaseProvider implements LLMProvider {
  abstract readonly name: ProviderName;
  abstract readonly models: string[];

  protected readonly startTime = new Map<string, number>();

  abstract capabilities(): ProviderCapabilities;
  abstract chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  abstract streamCompletion(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk>;

  /**
   * Check if model is in supported list or matches pattern
   */
  supportsModel(model: string): boolean {
    return this.models.some((m) => {
      if (m.endsWith("*")) {
        return model.startsWith(m.slice(0, -1));
      }
      return m === model;
    });
  }

  /**
   * Default dispose - override if cleanup needed
   */
  async dispose(): Promise<void> {
    // Default no-op
  }

  /**
   * Validate request parameters
   */
  protected validateRequest(request: ChatRequest): void {
    if (!request.model) {
      throw new ValidationError("Model is required", "model");
    }

    if (!request.messages || request.messages.length === 0) {
      throw new ValidationError("At least one message is required", "messages");
    }

    if (request.maxTokens <= 0) {
      throw new ValidationError("maxTokens must be positive", "maxTokens");
    }

    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw new ValidationError("temperature must be between 0 and 2", "temperature");
    }

    if (request.topP !== undefined && (request.topP < 0 || request.topP > 1)) {
      throw new ValidationError("topP must be between 0 and 1", "topP");
    }
  }

  /**
   * Check abort signal and throw if aborted
   */
  protected checkAbort(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new AbortError(new Error(signal.reason));
    }
  }

  /**
   * Start timing a request
   */
  protected startTiming(requestId: string): void {
    this.startTime.set(requestId, performance.now());
  }

  /**
   * Get elapsed time for a request
   */
  protected getLatency(requestId: string): number {
    const start = this.startTime.get(requestId);
    this.startTime.delete(requestId);
    return start ? Math.round(performance.now() - start) : 0;
  }

  /**
   * Generate a unique request ID
   */
  protected generateRequestId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Extract text content from a message
   */
  protected getTextContent(message: ChatMessage): string {
    if (typeof message.content === "string") {
      return message.content;
    }
    return message.content
      .filter((block): block is ContentBlock & { type: "text" } => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  /**
   * Check if message contains images
   */
  protected hasImages(message: ChatMessage): boolean {
    if (typeof message.content === "string") {
      return false;
    }
    return message.content.some((block) => block.type === "image");
  }
}
