import type { ChatRequest, ProviderName } from "../core/index.js";
import type { LLMProvider } from "../providers/index.js";

/**
 * Provider info for routing decisions
 */
export interface ProviderInfo {
  name: ProviderName;
  provider: LLMProvider;
  healthy: boolean;
  currentLoad?: number;
}

/**
 * Interface for routing strategies
 */
export interface IRoutingStrategy {
  /**
   * Strategy name for logging/debugging
   */
  readonly name: string;

  /**
   * Select a provider for the given request
   * @param request - The chat request
   * @param providers - Available providers with their info
   * @returns Selected provider name, or null if none suitable
   */
  select(request: ChatRequest, providers: ProviderInfo[]): ProviderName | null;
}

/**
 * Type guard for routing strategy
 */
export function isRoutingStrategy(obj: unknown): obj is IRoutingStrategy {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "select" in obj &&
    typeof (obj as IRoutingStrategy).select === "function"
  );
}
