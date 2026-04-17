import { describe, it, expect } from "vitest";
import { clientMessageSchema, type ValidClientMessage } from "../chat-message-validator.js";

describe("clientMessageSchema - Chat Message Validator", () => {
  describe("ping message validation", () => {
    it("should accept valid ping message with id", () => {
      const msg = { type: "ping", id: "msg-123" };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("ping");
        expect(result.data.id).toBe("msg-123");
      }
    });

    it("should accept valid ping message without id", () => {
      const msg = { type: "ping" };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("ping");
      }
    });

    it("should reject ping with invalid type", () => {
      const msg = { type: "invalid" };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("chat message validation", () => {
    it("should accept valid chat message with required fields", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("chat");
        expect(result.data.id).toBe("chat-123");
        expect(result.data.model).toBe("gpt-4");
      }
    });

    it("should accept chat message with all optional fields", () => {
      const msg = {
        type: "chat",
        id: "chat-456",
        model: "gpt-4",
        messages: [{ role: "assistant", content: "Hi there" }],
        maxTokens: 2000,
        temperature: 0.7,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTokens).toBe(2000);
        expect(result.data.temperature).toBe(0.7);
      }
    });

    it("should accept multiple messages in chat", () => {
      const msg = {
        type: "chat",
        id: "conv-1",
        model: "gpt-4",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
          { role: "user", content: "How are you?" },
        ],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toHaveLength(3);
      }
    });

    it("should accept message with array content", () => {
      const msg = {
        type: "chat",
        id: "chat-789",
        model: "gpt-4-vision",
        messages: [{ role: "user", content: [{ type: "text", text: "Describe this" }] }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should accept message with optional name field", () => {
      const msg = {
        type: "chat",
        id: "chat-named",
        model: "gpt-4",
        messages: [{ role: "tool", content: "Result", name: "my_tool" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should accept message with optional toolCallId field", () => {
      const msg = {
        type: "chat",
        id: "chat-tool",
        model: "gpt-4",
        messages: [{ role: "tool", content: "Result", toolCallId: "call-123" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should accept system messages", () => {
      const msg = {
        type: "chat",
        id: "sys-msg",
        model: "gpt-4",
        messages: [{ role: "system", content: "You are a helpful assistant" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("chat message - invalid id", () => {
    it("should reject chat message with empty id", () => {
      const msg = {
        type: "chat",
        id: "",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject chat message with id exceeding max length", () => {
      const msg = {
        type: "chat",
        id: "x".repeat(65),
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should accept chat message with id at max length", () => {
      const msg = {
        type: "chat",
        id: "x".repeat(64),
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should reject chat message without id", () => {
      const msg = {
        type: "chat",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("chat message - invalid model", () => {
    it("should reject chat message with empty model", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject chat message without model", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("chat message - invalid messages array", () => {
    it("should reject chat message with empty messages array", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject chat message without messages", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject message with invalid role", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "invalid_role", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject message without content", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("chat message - maxTokens validation", () => {
    it("should accept maxTokens at min boundary", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 1,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should accept maxTokens at max boundary", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 8192,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should reject maxTokens exceeding max", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 8193,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject negative maxTokens", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: -1,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject maxTokens as decimal", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 100.5,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject zero maxTokens", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 0,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("chat message - temperature validation", () => {
    it("should accept temperature at min boundary", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should accept temperature at max boundary", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 2,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should accept temperature between bounds", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.7,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("should reject temperature exceeding max", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: 2.1,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject negative temperature", () => {
      const msg = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
        temperature: -0.1,
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid message types", () => {
    it("should reject message with missing type", () => {
      const msg = {
        id: "test",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("should reject message with unknown type", () => {
      const msg = {
        type: "unknown",
        id: "test",
      };
      const result = clientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("type inference", () => {
    it("should correctly type valid chat message", () => {
      const msg: ValidClientMessage = {
        type: "chat",
        id: "chat-123",
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      };
      expect(msg.type).toBe("chat");
    });

    it("should correctly type valid ping message", () => {
      const msg: ValidClientMessage = {
        type: "ping",
        id: "ping-123",
      };
      expect(msg.type).toBe("ping");
    });
  });
});
