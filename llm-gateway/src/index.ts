// llm-gateway - Unified LLM Provider SDK
export const VERSION = "0.1.0";

// Main Gateway
export { LLMGateway, createGateway } from "./gateway.js";
export type { GatewayMetrics, GatewayRequestOptions } from "./gateway.js";

// Core types and errors
export * from "./core/index.js";

// Provider interface
export type { LLMProvider } from "./providers/index.js";
export { isLLMProvider, BaseProvider } from "./providers/index.js";
export {
  AnthropicProvider,
  OpenAIProvider,
  OllamaProvider,
  MiniMaxProvider,
} from "./providers/index.js";

// Factory
export { ProviderFactory } from "./factory/index.js";

// Routing
export type {
  IRoutingStrategy,
  ProviderInfo,
  RouterConfig,
  ProviderCost,
} from "./routing/index.js";
export {
  isRoutingStrategy,
  Router,
  RoundRobinStrategy,
  CostBasedStrategy,
  CapabilityBasedStrategy,
} from "./routing/index.js";

// Resilience
export {
  CircuitBreaker,
  CircuitState,
  FallbackChain,
  RetryDecorator,
} from "./resilience/index.js";
export type { CircuitMetrics, RetryEvent, RetryEventListener } from "./resilience/index.js";

// Telemetry
export { LLMTracer, LLMMetrics } from "./telemetry/index.js";
export type { LLMSpan } from "./telemetry/index.js";
