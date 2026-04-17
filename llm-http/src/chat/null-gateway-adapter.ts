import type { ChatRequest, ChatResponse, StreamChunk } from "llm-gateway";
import type { ChatGatewayPort, ChatGatewayMetrics } from "./chat-gateway-port.js";

export class NullGatewayAdapter implements ChatGatewayPort {
  async chat(_req: ChatRequest): Promise<ChatResponse> {
    throw new Error("No LLM providers configured");
  }

  async *stream(_req: ChatRequest, _signal: AbortSignal): AsyncIterable<StreamChunk> {
    throw new Error("No LLM providers configured");
  }

  getMetrics(): ChatGatewayMetrics {
    return { providers: [] };
  }

  async dispose(): Promise<void> {
    // no-op
  }
}
