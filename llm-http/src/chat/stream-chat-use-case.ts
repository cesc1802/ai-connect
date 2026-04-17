import type { ChatGatewayPort } from "./chat-gateway-port.js";
import type { ChatRequest, TokenUsage, FinishReason } from "llm-gateway";

export interface StreamCallbacks {
  onChunk(delta: string): void;
  onDone(usage: TokenUsage, finishReason: FinishReason): void;
  onError(err: Error): void;
}

export interface StreamHandle {
  abort(): void;
  done: Promise<void>;
}

export class StreamChatUseCase {
  constructor(private readonly gateway: ChatGatewayPort) {}

  execute(req: ChatRequest, cb: StreamCallbacks): StreamHandle {
    const controller = new AbortController();

    const done = (async () => {
      try {
        for await (const chunk of this.gateway.stream(req, controller.signal)) {
          if (chunk.delta?.type === "text") {
            cb.onChunk(chunk.delta.text);
          }
          if (chunk.finishReason && chunk.usage) {
            cb.onDone(chunk.usage, chunk.finishReason);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        cb.onError(err as Error);
      }
    })();

    return { abort: () => controller.abort(), done };
  }
}
