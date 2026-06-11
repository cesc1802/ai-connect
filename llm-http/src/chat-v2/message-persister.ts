import type { ChatEvent, ConversationRepository, MessageRepository } from "@ai-connect/shared";
import type { EventBus } from "../events/event-bus.js";

const TITLE_MAX_LENGTH = 60;

interface PendingStream {
  conversationId: string;
  buffer: string;
}

export interface MessagePersisterDeps {
  bus: EventBus<ChatEvent>;
  convRepo: ConversationRepository;
  msgRepo: MessageRepository;
}

// Persists the chat transcript as it flows through the event bus: the user
// turn at request time, the assistant turn once its stream settles. Failed
// streams persist nothing for the assistant turn; aborted ones keep whatever
// text arrived, flagged partial. Handler errors are logged by the bus.
export function attachMessagePersister(deps: MessagePersisterDeps): () => void {
  const pending = new Map<string, PendingStream>();
  const unsubs: Array<() => void> = [];

  unsubs.push(
    deps.bus.subscribe("chat.requested", async (e) => {
      pending.set(e.requestId, { conversationId: e.conversationId, buffer: "" });
      const last = e.messages[e.messages.length - 1];
      // Block-array content (multimodal) is not persisted yet.
      if (!last || last.role !== "user" || typeof last.content !== "string") return;
      await deps.msgRepo.append({
        conversationId: e.conversationId,
        role: "user",
        content: last.content,
        createdAt: Date.now(),
      });
      const conv = await deps.convRepo.get(e.conversationId);
      if (conv && !conv.title) {
        await deps.convRepo.updateTitle(e.conversationId, deriveTitle(last.content));
      } else {
        await deps.convRepo.touch(e.conversationId);
      }
    })
  );

  unsubs.push(
    deps.bus.subscribe("token.generated", (e) => {
      const p = pending.get(e.requestId);
      if (p && e.delta.kind === "text") p.buffer += e.delta.text;
    })
  );

  unsubs.push(
    deps.bus.subscribe("stream.completed", async (e) => {
      const p = pending.get(e.requestId);
      pending.delete(e.requestId);
      if (!p || !p.buffer) return;
      await deps.msgRepo.append({
        conversationId: p.conversationId,
        role: "assistant",
        content: p.buffer,
        createdAt: Date.now(),
      });
      await deps.convRepo.touch(p.conversationId);
    })
  );

  unsubs.push(
    deps.bus.subscribe("stream.aborted", async (e) => {
      const p = pending.get(e.requestId);
      pending.delete(e.requestId);
      if (!p || !p.buffer) return;
      await deps.msgRepo.append({
        conversationId: p.conversationId,
        role: "assistant",
        content: p.buffer,
        partial: true,
        createdAt: Date.now(),
      });
      await deps.convRepo.touch(p.conversationId);
    })
  );

  unsubs.push(
    deps.bus.subscribe("stream.failed", (e) => {
      pending.delete(e.requestId);
    })
  );

  return () => unsubs.forEach((fn) => fn());
}

function deriveTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= TITLE_MAX_LENGTH) return oneLine;
  return oneLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd() + "…";
}
