/**
 * Content block for multimodal messages
 */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: ImageSource };

export interface ImageSource {
  type: "base64" | "url";
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string; // base64 data or URL
}

/**
 * Unified chat message format
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
  name?: string;
  toolCallId?: string; // For tool responses
}

/**
 * Tool/function definition
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
}

/**
 * Tool call from assistant
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Chat completion request
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  responseFormat?: ResponseFormat;
  user?: string;
}

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; jsonSchema: JsonSchema };

/**
 * Chat completion response
 */
export interface ChatResponse {
  id: string;
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: FinishReason;
  latencyMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type FinishReason = "stop" | "length" | "tool_calls" | "content_filter" | "error";

/**
 * Streaming chunk
 */
export interface StreamChunk {
  id: string;
  delta: StreamDelta;
  finishReason?: FinishReason;
  usage?: TokenUsage;
}

export type StreamDelta =
  | { type: "text"; text: string }
  | { type: "tool_call_start"; toolCall: Partial<ToolCall> }
  | { type: "tool_call_delta"; toolCallId: string; arguments: string };

/**
 * Provider capabilities for routing decisions
 */
export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  jsonMode: boolean;
  maxContextTokens: number;
}

/**
 * Provider names as const for type safety
 */
export const PROVIDER_NAMES = ["anthropic", "openai", "ollama", "minimax"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];
