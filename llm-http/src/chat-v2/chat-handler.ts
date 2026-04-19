import type { EventBus } from "../events/event-bus.js";
import type { ChatEvent, ChatRequested } from "@ai-connect/shared";
import type { ChatGatewayPort } from "../chat/chat-gateway-port.js";
import type { Logger } from "../logger.js";
import { mapErrorToCode, sanitizeErrorMessage } from "../chat/error-mapper.js";
import { adaptStreamDeltaToTokenDelta } from "./gateway-chunk-adapter.js";

interface AbortControllerWithReason extends AbortController {
  _reason?: "client" | "timeout" | "manual";
}

export class ChatHandler {
  private active = new Map<string, AbortControllerWithReason>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly bus: EventBus<ChatEvent>,
    private readonly gateway: ChatGatewayPort,
    private readonly logger: Logger
  ) {}

  start(): void {
    this.unsubscribe = this.bus.subscribe("chat.requested", (e) => {
      void this.onChatRequested(e);
    });
  }

  abort(requestId: string, reason: "client" | "timeout" | "manual" = "manual"): void {
    const ctrl = this.active.get(requestId);
    if (!ctrl) return;
    ctrl._reason = reason;
    ctrl.abort();
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const ctrl of this.active.values()) ctrl.abort();
    this.active.clear();
  }

  private async onChatRequested(e: ChatRequested): Promise<void> {
    const ctrl: AbortControllerWithReason = new AbortController();
    this.active.set(e.requestId, ctrl);
    const startedAt = Date.now();

    await this.bus.publish({
      type: "stream.started",
      requestId: e.requestId,
      userId: e.userId,
      conversationId: e.conversationId,
      model: e.model,
      startedAt,
    });

    let index = 0;
    try {
      const streamRequest = {
        model: e.model,
        messages: e.messages,
        maxTokens: e.maxTokens ?? 4096,
        ...(e.temperature !== undefined && { temperature: e.temperature }),
      };

      for await (const chunk of this.gateway.stream(streamRequest, ctrl.signal)) {
        const delta = adaptStreamDeltaToTokenDelta(chunk.delta);
        if (delta) {
          await this.bus.publish({
            type: "token.generated",
            requestId: e.requestId,
            delta,
            index: index++,
          });
        }
        if (chunk.finishReason && chunk.usage) {
          await this.bus.publish({
            type: "stream.completed",
            requestId: e.requestId,
            usage: chunk.usage,
            finishReason: chunk.finishReason,
            latencyMs: Date.now() - startedAt,
          });
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        const reason = ctrl._reason ?? "client";
        await this.bus.publish({
          type: "stream.aborted",
          requestId: e.requestId,
          reason,
        });
      } else {
        const error = err as Error;
        this.logger.warn({ error, requestId: e.requestId }, "Stream failed");
        await this.bus.publish({
          type: "stream.failed",
          requestId: e.requestId,
          code: mapErrorToCode(error),
          message: sanitizeErrorMessage(error),
        });
      }
    } finally {
      this.active.delete(e.requestId);
    }
  }
}
