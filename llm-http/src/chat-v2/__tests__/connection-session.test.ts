import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import type { Conversation, Message, ChatEvent } from "@ai-connect/shared";
import { EventBus } from "../../events/event-bus.js";
import { ConnectionSession, type ConnectionSessionDeps } from "../connection-session.js";

function createMockSocket(): WebSocket & EventEmitter {
  const emitter = new EventEmitter() as WebSocket & EventEmitter;
  (emitter as unknown as { send: unknown }).send = vi.fn();
  (emitter as unknown as { close: unknown }).close = vi.fn();
  (emitter as unknown as { bufferedAmount: number }).bufferedAmount = 0;
  return emitter;
}

function createMockDeps(bus: EventBus<ChatEvent>): ConnectionSessionDeps {
  return {
    bus,
    chatHandler: { abort: vi.fn() } as unknown as ConnectionSessionDeps["chatHandler"],
    registry: { register: vi.fn(), unregister: vi.fn() } as unknown as ConnectionSessionDeps["registry"],
    convRepo: {
      create: vi.fn(),
      get: vi.fn(),
      listByUser: vi.fn(),
      updateTitle: vi.fn(),
    } as unknown as ConnectionSessionDeps["convRepo"],
    msgRepo: {
      append: vi.fn(),
      listByConversation: vi.fn(),
    } as unknown as ConnectionSessionDeps["msgRepo"],
    activeWorkspaceResolver: {
      getForUser: vi.fn().mockResolvedValue({ id: "ws-test", slug: "dev", name: "Dev" }),
    } as unknown as ConnectionSessionDeps["activeWorkspaceResolver"],
    workspaceMembersRepository: {
      isMember: vi.fn().mockResolvedValue(true),
    } as unknown as ConnectionSessionDeps["workspaceMembersRepository"],
    workspaceTemplatesRepository: {
      listForWorkspace: vi.fn().mockResolvedValue([]),
      getTemplate: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConnectionSessionDeps["workspaceTemplatesRepository"],
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ConnectionSessionDeps["logger"],
  };
}

describe("ConnectionSession", () => {
  let bus: EventBus<ChatEvent>;
  let ws: WebSocket & EventEmitter;
  let deps: ConnectionSessionDeps;
  let publishSpy: ReturnType<typeof vi.spyOn>;
  const user = { id: "user-1", username: "testuser" };
  const CONV_UUID = "550e8400-e29b-41d4-a716-446655440000";
  const OTHER_CONV_UUID = "550e8400-e29b-41d4-a716-446655440001";

  beforeEach(() => {
    bus = new EventBus<ChatEvent>();
    publishSpy = vi.spyOn(bus, "publish");
    ws = createMockSocket();
    deps = createMockDeps(bus);
  });

  describe("c.chat.send", () => {
    it("creates conversation when conversationId is absent", async () => {
      const newConv: Conversation = { id: "conv-new", workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(newConv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"s.conversation.created"'));
    });

    it("sends forbidden error when conversationId owned by other user", async () => {
      const otherUserConv: Conversation = { id: OTHER_CONV_UUID, workspaceId: "ws-test", userId: "other-user", createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.get).mockResolvedValue(otherUserConv);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        conversationId: OTHER_CONV_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"forbidden"'));
      });
    });

    it("loads history and prepends to messages", async () => {
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      const history: Message[] = [
        { id: "msg-1", conversationId: CONV_UUID, role: "user", content: "prev message", createdAt: 900 },
      ];
      vi.mocked(deps.convRepo.get).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue(history);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        conversationId: CONV_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "new message" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
          type: "chat.requested",
          messages: expect.arrayContaining([
            expect.objectContaining({ content: "prev message" }),
            expect.objectContaining({ content: "new message" }),
          ]),
        }));
      });
    });

    it("creates conversation in explicit workspace when caller is a member", async () => {
      const WS_UUID = "550e8400-e29b-41d4-a716-446655440010";
      const TEMPLATE_UUID = "550e8400-e29b-41d4-a716-446655440011";
      const newConv: Conversation = { id: "conv-new", workspaceId: WS_UUID, userId: user.id, templateId: TEMPLATE_UUID, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(newConv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);
      vi.mocked(deps.workspaceTemplatesRepository.listForWorkspace).mockResolvedValue([
        { id: TEMPLATE_UUID } as Awaited<ReturnType<typeof deps.workspaceTemplatesRepository.listForWorkspace>>[number],
      ]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        workspaceId: WS_UUID,
        templateId: TEMPLATE_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      expect(deps.workspaceMembersRepository.isMember).toHaveBeenCalledWith(user.id, WS_UUID);
      expect(deps.convRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        workspaceId: WS_UUID,
        templateId: TEMPLATE_UUID,
        userId: user.id,
      }));
      expect(deps.activeWorkspaceResolver.getForUser).not.toHaveBeenCalled();
    });

    it("sends forbidden when caller is not a member of explicit workspace", async () => {
      const WS_UUID = "550e8400-e29b-41d4-a716-446655440010";
      vi.mocked(deps.workspaceMembersRepository.isMember).mockResolvedValue(false);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        workspaceId: WS_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"forbidden"'));
      });
      expect(deps.convRepo.create).not.toHaveBeenCalled();
    });

    it("rejects templateId not attached to the target workspace", async () => {
      const WS_UUID = "550e8400-e29b-41d4-a716-446655440010";
      const TEMPLATE_UUID = "550e8400-e29b-41d4-a716-446655440011";
      vi.mocked(deps.workspaceTemplatesRepository.listForWorkspace).mockResolvedValue([]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        workspaceId: WS_UUID,
        templateId: TEMPLATE_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"invalid_template"'));
      });
      expect(deps.convRepo.create).not.toHaveBeenCalled();
    });

    it("prepends template body as system message when creating a conversation from a template", async () => {
      const WS_UUID = "550e8400-e29b-41d4-a716-446655440010";
      const TEMPLATE_UUID = "550e8400-e29b-41d4-a716-446655440011";
      const template = { id: TEMPLATE_UUID, body: "You are a pirate." };
      const newConv: Conversation = { id: "conv-new", workspaceId: WS_UUID, userId: user.id, templateId: TEMPLATE_UUID, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(newConv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);
      vi.mocked(deps.workspaceTemplatesRepository.listForWorkspace).mockResolvedValue([
        template as Awaited<ReturnType<typeof deps.workspaceTemplatesRepository.listForWorkspace>>[number],
      ]);
      vi.mocked(deps.workspaceTemplatesRepository.getTemplate).mockResolvedValue(
        template as Awaited<ReturnType<typeof deps.workspaceTemplatesRepository.getTemplate>>
      );

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        workspaceId: WS_UUID,
        templateId: TEMPLATE_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      expect(deps.workspaceTemplatesRepository.getTemplate).toHaveBeenCalledWith(TEMPLATE_UUID);
      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const messages = (publishCall?.[0] as { messages: Array<{ role: string; content: string }> }).messages;
      expect(messages[0]).toEqual({ role: "system", content: "You are a pirate." });
      expect(messages[1]).toEqual(expect.objectContaining({ role: "user", content: "hello" }));
    });

    it("prepends template body as system message on later turns of a templated conversation", async () => {
      const TEMPLATE_UUID = "550e8400-e29b-41d4-a716-446655440011";
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, templateId: TEMPLATE_UUID, createdAt: 1000, updatedAt: 1000 };
      const history: Message[] = [
        { id: "msg-1", conversationId: CONV_UUID, role: "user", content: "prev message", createdAt: 900 },
        { id: "msg-2", conversationId: CONV_UUID, role: "assistant", content: "prev reply", createdAt: 901 },
      ];
      vi.mocked(deps.convRepo.get).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue(history);
      vi.mocked(deps.workspaceTemplatesRepository.getTemplate).mockResolvedValue(
        { id: TEMPLATE_UUID, body: "You are a pirate." } as Awaited<ReturnType<typeof deps.workspaceTemplatesRepository.getTemplate>>
      );

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        conversationId: CONV_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "new message" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const messages = (publishCall?.[0] as { messages: Array<{ role: string; content: string }> }).messages;
      expect(messages.map((m) => [m.role, m.content])).toEqual([
        ["system", "You are a pirate."],
        ["user", "prev message"],
        ["assistant", "prev reply"],
        ["user", "new message"],
      ]);
    });

    it("omits system message when template body is empty", async () => {
      const TEMPLATE_UUID = "550e8400-e29b-41d4-a716-446655440011";
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, templateId: TEMPLATE_UUID, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.get).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);
      vi.mocked(deps.workspaceTemplatesRepository.getTemplate).mockResolvedValue(
        { id: TEMPLATE_UUID, body: null } as Awaited<ReturnType<typeof deps.workspaceTemplatesRepository.getTemplate>>
      );

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        conversationId: CONV_UUID,
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const messages = (publishCall?.[0] as { messages: Array<{ role: string }> }).messages;
      expect(messages.every((m) => m.role !== "system")).toBe(true);
    });

    it("forwards only the newest client message on top of stored history", async () => {
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      const history: Message[] = [
        { id: "msg-1", conversationId: CONV_UUID, role: "user", content: "prev message", createdAt: 900 },
        { id: "msg-2", conversationId: CONV_UUID, role: "assistant", content: "prev reply", createdAt: 901 },
      ];
      vi.mocked(deps.convRepo.get).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue(history);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      // Client resends its full local transcript; stored turns must not double up.
      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        conversationId: CONV_UUID,
        model: "gpt-4",
        messages: [
          { role: "user", content: "prev message" },
          { role: "assistant", content: "prev reply" },
          { role: "user", content: "new message" },
        ],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const messages = (publishCall?.[0] as { messages: Array<{ content: string }> }).messages;
      expect(messages.map((m) => m.content)).toEqual(["prev message", "prev reply", "new message"]);
    });

    it("sends not_found error when conversation does not exist", async () => {
      vi.mocked(deps.convRepo.get).mockResolvedValue(undefined);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"not_found"'));
      });
    });
  });

  describe("bus event filtering", () => {
    it("sends token to client for owned requestId", async () => {
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      vi.mocked(ws.send).mockClear();

      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const requestId = (publishCall?.[0] as { requestId: string })?.requestId;

      await bus.publish({
        type: "token.generated",
        requestId,
        delta: { kind: "text", text: "hi" },
        index: 0,
      });

      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"s.chat.token"'));
    });

    it("does not send token for unowned requestId", async () => {
      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      await bus.publish({
        type: "token.generated",
        requestId: "other-request",
        delta: { kind: "text", text: "hi" },
        index: 0,
      });

      expect(ws.send).not.toHaveBeenCalledWith(expect.stringContaining('"type":"s.chat.token"'));
    });
  });

  describe("c.chat.abort", () => {
    it("aborts owned requestId", async () => {
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const requestId = (publishCall?.[0] as { requestId: string })?.requestId;

      ws.emit("message", JSON.stringify({
        type: "c.chat.abort",
        requestId,
      }));

      await vi.waitFor(() => {
        expect(deps.chatHandler.abort).toHaveBeenCalledWith(requestId, "manual");
      });
    });

    it("sends forbidden for non-owned requestId", async () => {
      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.abort",
        requestId: "not-owned",
      }));

      await vi.waitFor(() => {
        expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"forbidden"'));
      });
      expect(deps.chatHandler.abort).not.toHaveBeenCalled();
    });
  });

  describe("c.ping", () => {
    it("responds with s.pong", () => {
      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({ type: "c.ping" }));

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "s.pong" }));
    });
  });

  describe("error handling", () => {
    it("sends invalid_json for malformed JSON", () => {
      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", "not json");

      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"invalid_json"'));
    });

    it("sends invalid_message for schema validation failure", () => {
      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({ type: "c.chat.send" }));

      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"code":"invalid_message"'));
    });
  });

  describe("socket close", () => {
    it("unregisters and aborts all owned requests on close", async () => {
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      ws.emit("close");

      expect(deps.registry.unregister).toHaveBeenCalledWith("conn-1");
      expect(deps.chatHandler.abort).toHaveBeenCalledWith(expect.any(String), "client");
    });

    it("does not send events after close", async () => {
      const conv: Conversation = { id: CONV_UUID, workspaceId: "ws-test", userId: user.id, createdAt: 1000, updatedAt: 1000 };
      vi.mocked(deps.convRepo.create).mockResolvedValue(conv);
      vi.mocked(deps.msgRepo.listByConversation).mockResolvedValue([]);

      const session = new ConnectionSession(ws, user, deps);
      session.start("conn-1");

      ws.emit("message", JSON.stringify({
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }));

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "chat.requested" }));
      });

      const publishCall = publishSpy.mock.calls.find(
        (call) => (call[0] as ChatEvent).type === "chat.requested"
      );
      const requestId = (publishCall?.[0] as { requestId: string })?.requestId;

      ws.emit("close");
      vi.mocked(ws.send).mockClear();

      await bus.publish({
        type: "token.generated",
        requestId,
        delta: { kind: "text", text: "late" },
        index: 0,
      });

      expect(ws.send).not.toHaveBeenCalled();
    });
  });
});
