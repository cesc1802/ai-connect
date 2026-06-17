import type {
  ChatEvent,
  ConversationRepository,
  UsageRepository,
} from "@ai-connect/shared";
import type { EventBus } from "../events/event-bus.js";
import type { Logger } from "../logger.js";
import type { ResolveActiveProviderId } from "./active-provider-resolver.js";

/** Context captured at request time, needed when the turn completes. */
interface PendingUsage {
  userId: string;
  conversationId: string;
  model: string;
}

export interface UsageRecorderDeps {
  bus: EventBus<ChatEvent>;
  convRepo: ConversationRepository;
  usageRepo: UsageRepository;
  resolveActiveProviderId: ResolveActiveProviderId;
  logger: Logger;
}

/**
 * Records one usage row per completed chat turn. `stream.completed` carries the
 * tokens but not the workspace/user/model, so we capture those at
 * `chat.requested` (keyed by requestId) and join on completion — the same
 * pending-map pattern the message persister uses. A metrics write must never
 * break the chat stream, so every failure is caught and logged.
 */
export function attachUsageRecorder(deps: UsageRecorderDeps): () => void {
  const pending = new Map<string, PendingUsage>();
  const unsubs: Array<() => void> = [];

  unsubs.push(
    deps.bus.subscribe("chat.requested", (e) => {
      pending.set(e.requestId, {
        userId: e.userId,
        conversationId: e.conversationId,
        model: e.model,
      });
    })
  );

  unsubs.push(
    deps.bus.subscribe("stream.completed", async (e) => {
      const ctx = pending.get(e.requestId);
      pending.delete(e.requestId);
      if (!ctx) {
        deps.logger.warn(
          { requestId: e.requestId },
          "Usage recorder: no pending context for completed stream; skipping"
        );
        return;
      }

      try {
        const conv = await deps.convRepo.get(ctx.conversationId);
        if (!conv) {
          deps.logger.warn(
            { requestId: e.requestId, conversationId: ctx.conversationId },
            "Usage recorder: conversation not found; skipping usage row"
          );
          return;
        }

        // Provider kind: the gateway-reported provider is authoritative; fall
        // back to the model prefix; record "unknown" rather than drop tokens.
        const providerKind =
          e.provider ?? kindFromModelPrefix(ctx.model) ?? "unknown";
        const providerId =
          providerKind === "unknown"
            ? null
            : await deps.resolveActiveProviderId(providerKind);

        await deps.usageRepo.record({
          workspaceId: conv.workspaceId,
          userId: ctx.userId,
          providerId,
          conversationId: ctx.conversationId,
          providerKind,
          model: ctx.model,
          promptTokens: e.usage.inputTokens,
          completionTokens: e.usage.outputTokens,
          latencyMs: e.latencyMs,
        });
      } catch (error) {
        deps.logger.error(
          { error, requestId: e.requestId },
          "Usage recorder: failed to record usage row"
        );
      }
    })
  );

  // Terminal-but-not-completed events: drop pending context, write no row.
  for (const type of ["stream.failed", "stream.aborted"] as const) {
    unsubs.push(
      deps.bus.subscribe(type, (e) => {
        pending.delete(e.requestId);
      })
    );
  }

  return () => unsubs.forEach((fn) => fn());
}

/**
 * Best-effort provider kind from a model string when the gateway did not report
 * one. Handles the `kind::model` and `kind/model` prefixes the providers use.
 * Bare models (e.g. "gpt-4-turbo") yield null — the caller records "unknown".
 */
export function kindFromModelPrefix(model: string): string | null {
  const match = model.match(/^([a-z0-9-]+)(?:::|\/)/i);
  return match ? match[1]!.toLowerCase() : null;
}
