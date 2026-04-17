import type { LLMGateway, ChatRequest, ChatResponse, StreamChunk } from "llm-gateway";
import type { ChatGatewayPort, ChatGatewayMetrics } from "./chat-gateway-port.js";

export class LlmGatewayAdapter implements ChatGatewayPort {
  constructor(private readonly gateway: LLMGateway) {}

  chat(req: ChatRequest): Promise<ChatResponse> {
    return this.gateway.chat(req);
  }

  async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    yield* this.gateway.stream(req, { signal });
  }

  getMetrics(): ChatGatewayMetrics {
    const metrics = this.gateway.getMetrics();
    return {
      providers: metrics.providers.map((p) => ({
        name: p.name,
        healthy: p.healthy,
      })),
    };
  }

  dispose(): Promise<void> {
    return this.gateway.dispose();
  }
}
