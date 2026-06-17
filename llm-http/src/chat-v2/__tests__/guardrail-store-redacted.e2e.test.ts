import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { EventBus } from "../../events/event-bus.js";
import { LocalConnectionRegistry } from "../../transport/local-connection-registry.js";
import {
  InMemoryConversationRepository,
  InMemoryMessageRepository,
  InMemoryActiveWorkspaceResolver,
} from "./in-memory-chat-test-fakes.js";
import { ChatHandler } from "../chat-handler.js";
import { attachMessagePersister } from "../message-persister.js";
import { attachChatV2Server, type V2ServerDeps, type V2WebSocketHandle } from "../websocket-server.js";
import type { ChatEvent } from "@ai-connect/shared";
import type { ChatGatewayPort } from "../chat-gateway-port.js";
import type { GatewayRequest, StreamChunk } from "llm-gateway";
import type { JwtService } from "../../auth/jwt-service.js";

// End-to-end proof of the store-redacted invariant: a workspace policy that
// redacts PII and blocks a term must mask the OUTBOUND provider request AND the
// PERSISTED transcript row for the same turn — and a blocked turn must never
// publish content to the provider, the transcript, or the failure event.

function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      server.close(() => resolve(addr.port));
    });
  });
}

const REDACT_AND_BLOCK_POLICY = {
  enabled: true,
  checks: [
    { kind: "pii", enabled: true, action: "redact" },
    { kind: "blocklist", enabled: true, action: "block", options: { terms: ["launchcode"] } },
  ],
};

const STREAM: StreamChunk[] = [
  { id: "1", delta: { type: "text", text: "ok" } },
  { id: "2", delta: { type: "text", text: "" }, finishReason: "end_turn", usage: { inputTokens: 4, outputTokens: 1 } },
];

describe("guardrail store-redacted invariant (e2e)", () => {
  let httpServer: Server;
  let handle: V2WebSocketHandle;
  let port: number;
  let bus: EventBus<ChatEvent>;
  let convRepo: InMemoryConversationRepository;
  let msgRepo: InMemoryMessageRepository;
  let chatHandler: ChatHandler;
  let detachPersister: () => void;
  let captured: { req: GatewayRequest | null };

  const mockJwtService: JwtService = {
    sign: vi.fn(),
    verify: vi.fn().mockReturnValue({ sub: "user-1", username: "testuser" }),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as V2ServerDeps["logger"];

  beforeEach(async () => {
    port = await getAvailablePort();
    httpServer = createServer();
    bus = new EventBus<ChatEvent>();
    convRepo = new InMemoryConversationRepository();
    msgRepo = new InMemoryMessageRepository(convRepo);
    captured = { req: null };

    const gateway: ChatGatewayPort = {
      chat: async () => { throw new Error("not implemented"); },
      getMetrics: () => ({ providers: [] }),
      dispose: async () => {},
      async *stream(req) {
        captured.req = req;
        for (const chunk of STREAM) yield chunk;
      },
    };

    chatHandler = new ChatHandler(bus, gateway, mockLogger);
    chatHandler.start();
    detachPersister = attachMessagePersister({ bus, convRepo, msgRepo });

    handle = attachChatV2Server(httpServer, {
      jwtService: mockJwtService,
      bus,
      chatHandler,
      registry: new LocalConnectionRegistry(),
      convRepo,
      msgRepo,
      activeWorkspaceResolver: new InMemoryActiveWorkspaceResolver(),
      workspaceMembersRepository: {
        isMember: vi.fn().mockResolvedValue(true),
      } as unknown as V2ServerDeps["workspaceMembersRepository"],
      workspaceTemplatesRepository: {
        listForWorkspace: vi.fn().mockResolvedValue([]),
      } as unknown as V2ServerDeps["workspaceTemplatesRepository"],
      guardrailPolicyRepository: {
        get: vi.fn().mockResolvedValue(REDACT_AND_BLOCK_POLICY),
        upsert: vi.fn(),
      } as unknown as V2ServerDeps["guardrailPolicyRepository"],
      logger: mockLogger,
    });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  });

  afterEach(async () => {
    detachPersister();
    await chatHandler.dispose();
    await handle.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function send(content: string, settleOn: string): Promise<Record<string, unknown>[]> {
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);
    const messages: Record<string, unknown>[] = [];
    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "c.chat.send", model: "gpt-4", messages: [{ role: "user", content }] }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        messages.push(msg);
        if (msg.type === settleOn) { ws.close(); resolve(messages); }
      });
      ws.on("error", reject);
      setTimeout(() => { ws.close(); resolve(messages); }, 5000);
    });
  }

  it("masks PII in both the outbound provider request and the persisted transcript row", async () => {
    await send("please reach me at alice@example.com", "s.chat.completed");

    // 1. Outbound provider request is masked — the raw email never leaves the boundary.
    const outboundText = JSON.stringify(captured.req?.messages);
    expect(captured.req).not.toBeNull();
    expect(outboundText).not.toContain("alice@example.com");
    expect(outboundText).toContain("[REDACTED:EMAIL]");

    // 2. Persisted transcript row for the same turn is masked (store-redacted).
    const convs = await convRepo.listByUser("user-1");
    expect(convs).toHaveLength(1);
    const persisted = await msgRepo.listByConversation(convs[0]!.id);
    const userRow = persisted.find((m) => m.role === "user");
    expect(userRow?.content).not.toContain("alice@example.com");
    expect(userRow?.content).toContain("[REDACTED:EMAIL]");
  });

  it("blocks a blocklisted term with no content reaching the provider, transcript, or failure event", async () => {
    const messages = await send("the launchcode is 1234", "s.chat.failed");

    const failed = messages.find((m) => m.type === "s.chat.failed");
    expect(failed).toMatchObject({ type: "s.chat.failed", code: "guardrail_blocked" });
    // Static, content-free failure message — never echoes the offending term.
    expect(JSON.stringify(failed)).not.toContain("launchcode");

    // The provider was never invoked and nothing was persisted.
    expect(captured.req).toBeNull();
    const convs = await convRepo.listByUser("user-1");
    for (const conv of convs) {
      const persisted = await msgRepo.listByConversation(conv.id);
      expect(JSON.stringify(persisted)).not.toContain("launchcode");
    }
  });
});
