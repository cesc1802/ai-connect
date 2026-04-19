import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryConversationRepository } from "../in-memory-conversation-repo.js";

describe("InMemoryConversationRepository", () => {
  let repo: InMemoryConversationRepository;

  beforeEach(() => {
    repo = new InMemoryConversationRepository();
  });

  describe("create", () => {
    it("returns conversation with generated id and timestamps", async () => {
      const now = Date.now();
      const conv = await repo.create({
        userId: "user-1",
        title: "Test Chat",
        createdAt: now,
        updatedAt: now,
      });

      expect(conv.id).toBeDefined();
      expect(typeof conv.id).toBe("string");
      expect(conv.userId).toBe("user-1");
      expect(conv.title).toBe("Test Chat");
      expect(conv.createdAt).toBe(now);
      expect(conv.updatedAt).toBe(now);
    });

    it("generates unique ids for each conversation", async () => {
      const now = Date.now();
      const conv1 = await repo.create({ userId: "u", createdAt: now, updatedAt: now });
      const conv2 = await repo.create({ userId: "u", createdAt: now, updatedAt: now });

      expect(conv1.id).not.toBe(conv2.id);
    });
  });

  describe("get", () => {
    it("returns undefined for unknown id", async () => {
      const result = await repo.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("returns created conversation by id", async () => {
      const now = Date.now();
      const created = await repo.create({ userId: "u", createdAt: now, updatedAt: now });
      const fetched = await repo.get(created.id);

      expect(fetched).toEqual(created);
    });
  });

  describe("listByUser", () => {
    it("returns empty array for user with no conversations", async () => {
      const result = await repo.listByUser("unknown");
      expect(result).toEqual([]);
    });

    it("returns only conversations belonging to user", async () => {
      const now = Date.now();
      const userA = await repo.create({ userId: "A", createdAt: now, updatedAt: now });
      await repo.create({ userId: "B", createdAt: now, updatedAt: now });

      const result = await repo.listByUser("A");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(userA.id);
    });

    it("returns conversations sorted by updatedAt desc", async () => {
      const conv1 = await repo.create({ userId: "u", createdAt: 100, updatedAt: 100 });
      const conv2 = await repo.create({ userId: "u", createdAt: 200, updatedAt: 300 });
      const conv3 = await repo.create({ userId: "u", createdAt: 150, updatedAt: 200 });

      const result = await repo.listByUser("u");

      expect(result.map((c) => c.id)).toEqual([conv2.id, conv3.id, conv1.id]);
    });
  });

  describe("updateTitle", () => {
    it("returns undefined for unknown id", async () => {
      const result = await repo.updateTitle("nonexistent", "New Title");
      expect(result).toBeUndefined();
    });

    it("updates title and bumps updatedAt", async () => {
      const now = Date.now();
      const conv = await repo.create({
        userId: "u",
        title: "Old",
        createdAt: now,
        updatedAt: now,
      });
      const originalUpdatedAt = conv.updatedAt;

      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.updateTitle(conv.id, "New Title");

      expect(updated?.title).toBe("New Title");
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it("persists title change in subsequent get", async () => {
      const now = Date.now();
      const conv = await repo.create({ userId: "u", createdAt: now, updatedAt: now });
      await repo.updateTitle(conv.id, "Updated");

      const fetched = await repo.get(conv.id);
      expect(fetched?.title).toBe("Updated");
    });
  });

  describe("multi-user isolation", () => {
    it("users cannot see each other's conversations", async () => {
      const now = Date.now();
      await repo.create({ userId: "alice", title: "Alice Chat", createdAt: now, updatedAt: now });
      await repo.create({ userId: "bob", title: "Bob Chat", createdAt: now, updatedAt: now });

      const aliceConvs = await repo.listByUser("alice");
      const bobConvs = await repo.listByUser("bob");

      expect(aliceConvs).toHaveLength(1);
      expect(aliceConvs[0].title).toBe("Alice Chat");
      expect(bobConvs).toHaveLength(1);
      expect(bobConvs[0].title).toBe("Bob Chat");
    });
  });
});
