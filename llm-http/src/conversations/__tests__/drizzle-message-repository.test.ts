import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDbClient,
  conversations,
  messages,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleMessageRepository } from "../drizzle-message-repository.js";
import { DrizzleConversationRepository } from "../drizzle-conversation-repository.js";
import { seedTestIdentity } from "./seed-test-identity.js";

// Dedicated identity for this file so its cleanup never races other test files.
const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-0000000000c2";
const DEV_USER_ID = "00000000-0000-0000-0000-0000000000d2";

// Live DB tests; skipped unless DATABASE_URL points at a migrated Postgres.
const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleMessageRepository", () => {
  let client: DbClient;
  let msgRepo: DrizzleMessageRepository;
  let convRepo: DrizzleConversationRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    await seedTestIdentity(client, {
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      slug: "msg-repo-test",
    });
    msgRepo = new DrizzleMessageRepository(client);
    convRepo = new DrizzleConversationRepository(client);
  });

  afterEach(async () => {
    // Conversations cascade-delete their messages; dev seed rows are kept.
    await client.db
      .delete(conversations)
      .where(eq(conversations.userId, DEV_USER_ID));
  });

  afterAll(async () => {
    await client.close();
  });

  async function newConversation() {
    const now = Date.now();
    return convRepo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      createdAt: now,
      updatedAt: now,
    });
  }

  it("append returns row with generated id and persisted fields", async () => {
    const conv = await newConversation();
    const msg = await msgRepo.append({
      conversationId: conv.id,
      role: "user",
      content: "Hi there",
      createdAt: Date.now(),
    });

    expect(msg.id).toBeDefined();
    expect(msg.conversationId).toBe(conv.id);
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hi there");
  });

  it("append bumps the parent conversation updatedAt", async () => {
    const conv = await newConversation();
    const bumpAt = conv.updatedAt + 10_000;

    await msgRepo.append({
      conversationId: conv.id,
      role: "assistant",
      content: "Reply",
      createdAt: bumpAt,
    });

    const refetched = await convRepo.get(conv.id);
    expect(refetched?.updatedAt).toBe(bumpAt);
  });

  it("listByConversation returns messages sorted by createdAt asc", async () => {
    const conv = await newConversation();
    await msgRepo.append({
      conversationId: conv.id,
      role: "user",
      content: "second",
      createdAt: 200,
    });
    await msgRepo.append({
      conversationId: conv.id,
      role: "user",
      content: "first",
      createdAt: 100,
    });
    await msgRepo.append({
      conversationId: conv.id,
      role: "user",
      content: "third",
      createdAt: 300,
    });

    const result = await msgRepo.listByConversation(conv.id);
    expect(result.map((m) => m.content)).toEqual(["first", "second", "third"]);
  });

  it("listByConversation returns empty array for unknown conversation", async () => {
    const result = await msgRepo.listByConversation(
      "00000000-0000-0000-0000-0000deadbeef"
    );
    expect(result).toEqual([]);
  });
});
