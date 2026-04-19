import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryConversationRepository } from "../in-memory-conversation-repo.js";
import { InMemoryMessageRepository } from "../in-memory-message-repo.js";

describe("InMemoryMessageRepository", () => {
  let convRepo: InMemoryConversationRepository;
  let msgRepo: InMemoryMessageRepository;
  let testConvId: string;

  beforeEach(async () => {
    convRepo = new InMemoryConversationRepository();
    msgRepo = new InMemoryMessageRepository(convRepo);

    const conv = await convRepo.create({
      userId: "user-1",
      createdAt: 1000,
      updatedAt: 1000,
    });
    testConvId = conv.id;
  });

  describe("append", () => {
    it("returns message with generated id", async () => {
      const msg = await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "Hello",
        createdAt: 2000,
      });

      expect(msg.id).toBeDefined();
      expect(typeof msg.id).toBe("string");
      expect(msg.conversationId).toBe(testConvId);
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello");
      expect(msg.createdAt).toBe(2000);
    });

    it("generates unique ids for each message", async () => {
      const msg1 = await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "1",
        createdAt: 2000,
      });
      const msg2 = await msgRepo.append({
        conversationId: testConvId,
        role: "assistant",
        content: "2",
        createdAt: 2001,
      });

      expect(msg1.id).not.toBe(msg2.id);
    });

    it("bumps parent conversation updatedAt", async () => {
      const convBefore = await convRepo.get(testConvId);
      expect(convBefore?.updatedAt).toBe(1000);

      await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "Hello",
        createdAt: 5000,
      });

      const convAfter = await convRepo.get(testConvId);
      expect(convAfter?.updatedAt).toBe(5000);
    });

    it("preserves partial flag when true", async () => {
      const msg = await msgRepo.append({
        conversationId: testConvId,
        role: "assistant",
        content: "Partial...",
        partial: true,
        createdAt: 2000,
      });

      expect(msg.partial).toBe(true);
    });

    it("preserves partial flag when false/undefined", async () => {
      const msg1 = await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "No partial",
        createdAt: 2000,
      });
      const msg2 = await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "Explicit false",
        partial: false,
        createdAt: 2001,
      });

      expect(msg1.partial).toBeUndefined();
      expect(msg2.partial).toBe(false);
    });
  });

  describe("listByConversation", () => {
    it("returns empty array for unknown conversation", async () => {
      const result = await msgRepo.listByConversation("nonexistent");
      expect(result).toEqual([]);
    });

    it("returns messages in insertion order", async () => {
      const msg1 = await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "First",
        createdAt: 100,
      });
      const msg2 = await msgRepo.append({
        conversationId: testConvId,
        role: "assistant",
        content: "Second",
        createdAt: 200,
      });
      const msg3 = await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "Third",
        createdAt: 300,
      });

      const result = await msgRepo.listByConversation(testConvId);

      expect(result.map((m) => m.id)).toEqual([msg1.id, msg2.id, msg3.id]);
    });

    it("returns copy of array (not mutable reference)", async () => {
      await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "Test",
        createdAt: 2000,
      });

      const list1 = await msgRepo.listByConversation(testConvId);
      list1.push({
        id: "fake",
        conversationId: testConvId,
        role: "user",
        content: "Injected",
        createdAt: 9999,
      });

      const list2 = await msgRepo.listByConversation(testConvId);
      expect(list2).toHaveLength(1);
    });
  });

  describe("conversation isolation", () => {
    it("messages belong only to their conversation", async () => {
      const conv2 = await convRepo.create({
        userId: "user-1",
        createdAt: 1000,
        updatedAt: 1000,
      });

      await msgRepo.append({
        conversationId: testConvId,
        role: "user",
        content: "Conv1 msg",
        createdAt: 2000,
      });
      await msgRepo.append({
        conversationId: conv2.id,
        role: "user",
        content: "Conv2 msg",
        createdAt: 2000,
      });

      const conv1Msgs = await msgRepo.listByConversation(testConvId);
      const conv2Msgs = await msgRepo.listByConversation(conv2.id);

      expect(conv1Msgs).toHaveLength(1);
      expect(conv1Msgs[0].content).toBe("Conv1 msg");
      expect(conv2Msgs).toHaveLength(1);
      expect(conv2Msgs[0].content).toBe("Conv2 msg");
    });
  });

  describe("role types", () => {
    it("supports all message roles", async () => {
      const roles: Array<"system" | "user" | "assistant" | "tool"> = [
        "system",
        "user",
        "assistant",
        "tool",
      ];

      for (const role of roles) {
        const msg = await msgRepo.append({
          conversationId: testConvId,
          role,
          content: `${role} message`,
          createdAt: Date.now(),
        });
        expect(msg.role).toBe(role);
      }
    });
  });
});
