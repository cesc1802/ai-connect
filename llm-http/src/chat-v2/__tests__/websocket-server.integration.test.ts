import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { EventBus } from "../../events/event-bus.js";
import { LocalConnectionRegistry } from "../../transport/local-connection-registry.js";
import { InMemoryConversationRepository } from "../../repositories/in-memory-conversation-repo.js";
import { InMemoryMessageRepository } from "../../repositories/in-memory-message-repo.js";
import { ChatHandler } from "../chat-handler.js";
import { attachChatV2Server, type V2ServerDeps, type V2WebSocketHandle } from "../websocket-server.js";
import type { ChatEvent } from "@ai-connect/shared";
import type { ChatGatewayPort } from "../../chat/chat-gateway-port.js";
import type { StreamChunk } from "llm-gateway";
import type { JwtService } from "../../auth/jwt-service.js";

function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      server.close(() => resolve(addr.port));
    });
  });
}

function createFakeGateway(chunks: StreamChunk[]): ChatGatewayPort {
  return {
    chat: async () => { throw new Error("not implemented"); },
    getMetrics: () => ({ providers: [] }),
    dispose: async () => {},
    async *stream(_req, _signal) {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe("attachChatV2Server integration", () => {
  let httpServer: Server;
  let handle: V2WebSocketHandle;
  let port: number;
  let bus: EventBus<ChatEvent>;
  let convRepo: InMemoryConversationRepository;
  let msgRepo: InMemoryMessageRepository;
  let chatHandler: ChatHandler;

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

    const gateway = createFakeGateway([
      { id: "1", delta: { type: "text", text: "Hello" } },
      { id: "2", delta: { type: "text", text: " world" } },
      { id: "3", delta: { type: "text", text: "" }, finishReason: "end_turn", usage: { inputTokens: 10, outputTokens: 5 } },
    ]);

    chatHandler = new ChatHandler(bus, gateway, mockLogger);
    chatHandler.start();

    const registry = new LocalConnectionRegistry();

    handle = attachChatV2Server(httpServer, {
      jwtService: mockJwtService,
      bus,
      chatHandler,
      registry,
      convRepo,
      msgRepo,
      logger: mockLogger,
    });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  });

  afterEach(async () => {
    await chatHandler.dispose();
    await handle.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("rejects connection with invalid token", async () => {
    vi.mocked(mockJwtService.verify).mockImplementationOnce(() => {
      throw new Error("invalid");
    });

    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=bad`);

    await new Promise<void>((resolve, reject) => {
      ws.on("error", () => resolve());
      ws.on("open", () => reject(new Error("should not connect")));
      setTimeout(() => reject(new Error("timeout")), 2000);
    });
  });

  it("accepts connection with valid token", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.close();
        resolve();
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });
  });

  it("responds to ping with pong", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);

    const pong = await new Promise<unknown>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "c.ping" }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "s.pong") {
          ws.close();
          resolve(msg);
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });

    expect(pong).toEqual({ type: "s.pong" });
  });

  it("streams chat response", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);
    const messages: unknown[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "c.chat.send",
          model: "gpt-4",
          messages: [{ role: "user", content: "hello" }],
        }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === "s.chat.completed") {
          ws.close();
          resolve();
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    const types = messages.map((m: unknown) => (m as { type: string }).type);
    expect(types).toContain("s.conversation.created");
    expect(types).toContain("s.chat.started");
    expect(types).toContain("s.chat.token");
    expect(types).toContain("s.chat.completed");
  });

  it("handles abort mid-stream", async () => {
    const slowGateway = createFakeGateway([
      { id: "1", delta: { type: "text", text: "1" } },
      { id: "2", delta: { type: "text", text: "2" } },
      { id: "3", delta: { type: "text", text: "3" } },
    ]);

    const slowChatHandler = new ChatHandler(bus, {
      async *stream(req, signal) {
        for await (const chunk of slowGateway.stream(req, signal)) {
          await new Promise((r) => setTimeout(r, 100));
          if (signal.aborted) return;
          yield chunk;
        }
      },
    }, mockLogger);
    slowChatHandler.start();

    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);
    const messages: unknown[] = [];

    await new Promise<void>((resolve, reject) => {
      let requestId: string | null = null;

      ws.on("open", () => {
        ws.send(JSON.stringify({
          type: "c.chat.send",
          model: "gpt-4",
          messages: [{ role: "user", content: "hello" }],
        }));
      });

      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as { type: string; requestId?: string };
        messages.push(msg);

        if (msg.type === "s.chat.started" && msg.requestId) {
          requestId = msg.requestId;
          setTimeout(() => {
            ws.send(JSON.stringify({ type: "c.chat.abort", requestId }));
          }, 50);
        }

        if (msg.type === "s.chat.aborted") {
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
      setTimeout(() => {
        ws.close();
        resolve();
      }, 3000);
    });

    await slowChatHandler.dispose();

    const types = messages.map((m: unknown) => (m as { type: string }).type);
    expect(types).toContain("s.chat.started");
  });

  it("returns error for invalid JSON", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);

    const error = await new Promise<unknown>((resolve, reject) => {
      ws.on("open", () => {
        ws.send("not json");
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "s.error") {
          ws.close();
          resolve(msg);
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });

    expect(error).toMatchObject({ type: "s.error", code: "invalid_json" });
  });

  it("returns error for invalid message schema", async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/chat/v2?token=valid`);

    const error = await new Promise<unknown>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "c.chat.send" }));
      });
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "s.error") {
          ws.close();
          resolve(msg);
        }
      });
      ws.on("error", reject);
      setTimeout(() => reject(new Error("timeout")), 2000);
    });

    expect(error).toMatchObject({ type: "s.error", code: "invalid_message" });
  });
});
