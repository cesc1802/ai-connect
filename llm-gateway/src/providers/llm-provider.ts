import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
  ProviderName,
} from "../core/index.js";

/**
 * Core interface that all LLM providers must implement
 */
export interface LLMProvider {
  /**
   * Provider identifier (e.g., "anthropic", "openai")
   */
  readonly name: ProviderName;

  /**
   * List of supported model identifiers
   */
  readonly models: string[];

  /**
   * Returns the provider's capabilities
   */
  capabilities(): ProviderCapabilities;

  /**
   * Execute a chat completion request
   * @param request - The chat request parameters
   * @param signal - Optional AbortSignal for cancellation
   * @returns The completion response
   */
  chatCompletion(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;

  /**
   * Execute a streaming chat completion request
   * @param request - The chat request parameters
   * @param signal - Optional AbortSignal for cancellation
   * @yields Stream chunks with deltas
   */
  streamCompletion(request: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamChunk>;

  /**
   * Check if a specific model is supported
   */
  supportsModel(model: string): boolean;

  /**
   * Dispose of any resources (connections, etc.)
   */
  dispose(): Promise<void>;
}

/**
 * Type guard for LLMProvider
 */
export function isLLMProvider(obj: unknown): obj is LLMProvider {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "chatCompletion" in obj &&
    "streamCompletion" in obj &&
    typeof (obj as LLMProvider).chatCompletion === "function" &&
    typeof (obj as LLMProvider).streamCompletion === "function"
  );
}
