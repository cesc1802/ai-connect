import { describe, it, expect } from "vitest";
import { clientV2MessageSchema } from "../client-message-schema.js";

describe("clientV2MessageSchema", () => {
  describe("c.chat.send", () => {
    it("parses valid message with required fields", () => {
      const msg = {
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("c.chat.send");
      }
    });

    it("parses valid message with all optional fields", () => {
      const msg = {
        type: "c.chat.send",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 1000,
        temperature: 0.7,
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("fails when model is missing", () => {
      const msg = {
        type: "c.chat.send",
        messages: [{ role: "user", content: "hello" }],
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("fails when model is empty", () => {
      const msg = {
        type: "c.chat.send",
        model: "",
        messages: [{ role: "user", content: "hello" }],
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("fails when messages is empty", () => {
      const msg = {
        type: "c.chat.send",
        model: "gpt-4",
        messages: [],
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("fails when conversationId is not UUID", () => {
      const msg = {
        type: "c.chat.send",
        conversationId: "not-a-uuid",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("fails when maxTokens exceeds 8192", () => {
      const msg = {
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 10000,
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("fails when temperature exceeds 2", () => {
      const msg = {
        type: "c.chat.send",
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        temperature: 2.5,
      };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("c.chat.abort", () => {
    it("parses valid abort message", () => {
      const msg = { type: "c.chat.abort", requestId: "req-123" };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it("fails when requestId is missing", () => {
      const msg = { type: "c.chat.abort" };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it("fails when requestId is empty", () => {
      const msg = { type: "c.chat.abort", requestId: "" };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe("c.ping", () => {
    it("parses valid ping message", () => {
      const msg = { type: "c.ping" };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("unknown type", () => {
    it("fails for unknown message type", () => {
      const msg = { type: "c.unknown" };
      const result = clientV2MessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });
});
