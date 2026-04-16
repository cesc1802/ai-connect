// llm-gateway - Unified LLM Provider SDK
export const VERSION = "0.1.0";

// Re-export core types and errors
export * from "./core/index.js";

// Re-export provider interface
export type { LLMProvider } from "./providers/index.js";
export { isLLMProvider, BaseProvider } from "./providers/index.js";

// Re-export factory
export { ProviderFactory } from "./factory/index.js";
