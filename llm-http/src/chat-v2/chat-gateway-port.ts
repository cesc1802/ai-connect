import type { ChatRequest, ChatResponse, StreamChunk } from "llm-gateway";

export interface ProviderHealth {
  name: string;
  healthy: boolean;
}

export interface ChatGatewayMetrics {
  providers: ProviderHealth[];
}

export interface ChatGatewayPort {
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk>;
  getMetrics(): ChatGatewayMetrics;
  dispose(): Promise<void>;
}
