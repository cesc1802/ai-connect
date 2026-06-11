import { describe, it, expect, beforeEach } from "vitest";
import type { ChatEvent, Conversation } from "@ai-connect/shared";
import { EventBus } from "../../events/event-bus.js";
import { attachMessagePersister } from "../message-persister.js";
import {
  InMemoryConversationRepository,
  InMemoryMessageRepository,
} from "./in-memory-chat-test-fakes.js";

describe("message persister", () => {
  let bus: EventBus<ChatEvent>;
  let convRepo: InMemoryConversationRepository;
  let msgRepo: InMemoryMessageRepository;
  let conv: Conversation;

  beforeEach(async () => {
    bus = new EventBus<ChatEvent>();
    convRepo = new InMemoryConversationRepository();
    msgRepo = new InMemoryMessageRepository(convRepo);
    attachMessagePersister({ bus, convRepo, msgRepo });
    conv = await convRepo.create({
      workspaceId: "ws-1",
      userId: "u1",
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  function requested(overrides?: Partial<Extract<ChatEvent, { type: "chat.requested" }>>) {
    return bus.publish({
      type: "chat.requested",
      requestId: "req-1",
      userId: "u1",
      conversationId: conv.id,
      model: "gpt-4",
      messages: [{ role: "user", content: "hello there" }],
      ...overrides,
    });
  }

  it("persists the user turn and titles an untitled conversation", async () => {
    await requested();

    const stored = await msgRepo.listByConversation(conv.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ role: "user", content: "hello there" });
    expect((await convRepo.get(conv.id))?.title).toBe("hello there");
  });

  it("keeps an existing title and bumps updatedAt instead", async () => {
    await convRepo.updateTitle(conv.id, "Existing title");
    const before = (await convRepo.get(conv.id))!.updatedAt;

    await requested({ messages: [{ role: "user", content: "follow-up" }] });

    const after = (await convRepo.get(conv.id))!;
    expect(after.title).toBe("Existing title");
    expect(after.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("truncates long first messages into a single-line title", async () => {
    const long = "word ".repeat(40);
    await requested({ messages: [{ role: "user", content: long }] });

    const title = (await convRepo.get(conv.id))!.title!;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("persists accumulated text deltas as the assistant turn on completion", async () => {
    await requested();
    await bus.publish({ type: "token.generated", requestId: "req-1", delta: { kind: "text", text: "Hi " }, index: 0 });
    await bus.publish({ type: "token.generated", requestId: "req-1", delta: { kind: "thinking", text: "ignored" }, index: 1 });
    await bus.publish({ type: "token.generated", requestId: "req-1", delta: { kind: "text", text: "friend" }, index: 2 });
    await bus.publish({
      type: "stream.completed",
      requestId: "req-1",
      usage: { inputTokens: 1, outputTokens: 2 },
      finishReason: "end_turn",
      latencyMs: 5,
    });

    const stored = await msgRepo.listByConversation(conv.id);
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({ role: "assistant", content: "Hi friend" });
    expect(stored[1]!.partial).toBeUndefined();
  });

  it("persists a partial assistant turn on abort when text already streamed", async () => {
    await requested();
    await bus.publish({ type: "token.generated", requestId: "req-1", delta: { kind: "text", text: "half an ans" }, index: 0 });
    await bus.publish({ type: "stream.aborted", requestId: "req-1", reason: "manual" });

    const stored = await msgRepo.listByConversation(conv.id);
    expect(stored[1]).toMatchObject({ role: "assistant", content: "half an ans", partial: true });
  });

  it("persists nothing extra on abort before any text arrived", async () => {
    await requested();
    await bus.publish({ type: "stream.aborted", requestId: "req-1", reason: "client" });

    expect(await msgRepo.listByConversation(conv.id)).toHaveLength(1);
  });

  it("persists no assistant turn when the stream fails", async () => {
    await requested();
    await bus.publish({ type: "token.generated", requestId: "req-1", delta: { kind: "text", text: "doomed" }, index: 0 });
    await bus.publish({ type: "stream.failed", requestId: "req-1", code: "upstream", message: "boom" });
    await bus.publish({
      type: "stream.completed",
      requestId: "req-1",
      usage: { inputTokens: 1, outputTokens: 0 },
      finishReason: "end_turn",
      latencyMs: 5,
    });

    expect(await msgRepo.listByConversation(conv.id)).toHaveLength(1);
  });

  it("skips the user turn when the last request message is not from the user", async () => {
    await requested({ messages: [{ role: "system", content: "system prompt" }] });

    expect(await msgRepo.listByConversation(conv.id)).toHaveLength(0);
  });
});
