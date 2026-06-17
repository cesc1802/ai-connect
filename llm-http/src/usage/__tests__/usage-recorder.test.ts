import { describe, it, expect, beforeEach } from "vitest";
import type {
  ChatEvent,
  Conversation,
  NewUsageRecord,
  ProviderUsage,
  UsageRepository,
  WorkspaceUsage,
} from "@ai-connect/shared";
import { EventBus } from "../../events/event-bus.js";
import { attachUsageRecorder } from "../usage-recorder.js";
import { kindFromModelPrefix } from "../usage-recorder.js";
import { InMemoryConversationRepository } from "../../chat-v2/__tests__/in-memory-chat-test-fakes.js";

class FakeUsageRepository implements UsageRepository {
  readonly rows: NewUsageRecord[] = [];
  async record(input: NewUsageRecord): Promise<void> {
    this.rows.push(input);
  }
  async aggregateByProvider(): Promise<ProviderUsage[]> {
    return [];
  }
  async aggregateByWorkspace(): Promise<WorkspaceUsage[]> {
    return [];
  }
}

const noopLogger = {
  warn: () => {},
  error: () => {},
  info: () => {},
  debug: () => {},
} as never;

describe("usage recorder", () => {
  let bus: EventBus<ChatEvent>;
  let convRepo: InMemoryConversationRepository;
  let usageRepo: FakeUsageRepository;
  let conv: Conversation;
  // Resolver: maps a known kind to a provider id; null otherwise.
  const resolveActiveProviderId = async (kind: string) =>
    kind === "anthropic" ? "prov-anthropic" : null;

  beforeEach(async () => {
    bus = new EventBus<ChatEvent>();
    convRepo = new InMemoryConversationRepository();
    usageRepo = new FakeUsageRepository();
    attachUsageRecorder({
      bus,
      convRepo,
      usageRepo,
      resolveActiveProviderId,
      logger: noopLogger,
    });
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
      model: "claude-3",
      messages: [{ role: "user", content: "hi" }],
      ...overrides,
    });
  }

  function completed(overrides?: Partial<Extract<ChatEvent, { type: "stream.completed" }>>) {
    return bus.publish({
      type: "stream.completed",
      requestId: "req-1",
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
      finishReason: "stop",
      latencyMs: 1200,
      ...overrides,
    });
  }

  it("records one row with correct token split, workspace, and resolved providerId", async () => {
    await requested();
    await completed({ provider: "anthropic" });

    expect(usageRepo.rows).toHaveLength(1);
    expect(usageRepo.rows[0]).toMatchObject({
      workspaceId: "ws-1",
      userId: "u1",
      providerId: "prov-anthropic",
      conversationId: conv.id,
      providerKind: "anthropic",
      model: "claude-3",
      promptTokens: 100,
      completionTokens: 40,
      latencyMs: 1200,
    });
  });

  it("falls back to the model prefix when the event has no provider", async () => {
    await requested({ model: "anthropic::claude-3" });
    await completed();

    expect(usageRepo.rows[0]).toMatchObject({
      providerKind: "anthropic",
      providerId: "prov-anthropic",
    });
  });

  it("records providerKind=unknown and providerId=null when no kind can be derived", async () => {
    await requested({ model: "gpt-4-turbo" });
    await completed();

    expect(usageRepo.rows[0]).toMatchObject({
      providerKind: "unknown",
      providerId: null,
    });
  });

  it("writes no row on stream.failed", async () => {
    await requested();
    await bus.publish({
      type: "stream.failed",
      requestId: "req-1",
      code: "ERR",
      message: "boom",
    });
    await completed(); // late completion has no pending context

    expect(usageRepo.rows).toHaveLength(0);
  });

  it("writes no row on stream.aborted", async () => {
    await requested();
    await bus.publish({
      type: "stream.aborted",
      requestId: "req-1",
      reason: "client",
    });

    expect(usageRepo.rows).toHaveLength(0);
  });

  it("skips the row (no throw) when the conversation is missing", async () => {
    await requested({ conversationId: "missing-conv" });
    await completed({ provider: "anthropic" });

    expect(usageRepo.rows).toHaveLength(0);
  });

  it("kindFromModelPrefix parses kind:: and kind/ prefixes, null for bare models", () => {
    expect(kindFromModelPrefix("anthropic::claude-3")).toBe("anthropic");
    expect(kindFromModelPrefix("minimax/MiniMax-M2")).toBe("minimax");
    expect(kindFromModelPrefix("gpt-4-turbo")).toBeNull();
  });
});
