import type { ChatRequest, ChatResponse } from "llm-gateway";
import type { ChatGatewayPort } from "./chat-gateway-port.js";

export class OneShotChatUseCase {
  constructor(private gateway: ChatGatewayPort) {}

  execute(req: ChatRequest): Promise<ChatResponse> {
    return this.gateway.chat(req);
  }
}
