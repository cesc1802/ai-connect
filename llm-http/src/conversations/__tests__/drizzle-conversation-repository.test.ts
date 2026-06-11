import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createDbClient, conversations, type DbClient } from "@ai-connect/db";
import { DrizzleConversationRepository } from "../drizzle-conversation-repository.js";
import { seedTestIdentity } from "./seed-test-identity.js";

// Dedicated identity for this file so its cleanup never races other test files.
const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-0000000000c1";
const DEV_USER_ID = "00000000-0000-0000-0000-0000000000d1";

// Live DB tests; skipped unless DATABASE_URL points at a migrated Postgres.
const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleConversationRepository", () => {
  let client: DbClient;
  let repo: DrizzleConversationRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    await seedTestIdentity(client, {
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      slug: "conv-repo-test",
    });
    repo = new DrizzleConversationRepository(client);
  });

  afterEach(async () => {
    // Remove rows created by tests; seeded workspace/user rows are kept.
    await client.db
      .delete(conversations)
      .where(eq(conversations.userId, DEV_USER_ID));
  });

  afterAll(async () => {
    await client.close();
  });

  it("create returns row with generated id and persisted fields", async () => {
    const now = Date.now();
    const conv = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      title: "Hello",
      createdAt: now,
      updatedAt: now,
    });

    expect(conv.id).toBeDefined();
    expect(conv.workspaceId).toBe(DEV_WORKSPACE_ID);
    expect(conv.userId).toBe(DEV_USER_ID);
    expect(conv.title).toBe("Hello");
  });

  it("create without title surfaces title as undefined", async () => {
    const now = Date.now();
    const conv = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      createdAt: now,
      updatedAt: now,
    });

    expect(conv.title).toBeUndefined();
  });

  it("get returns the created conversation, undefined for unknown id", async () => {
    const now = Date.now();
    const created = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      title: "Fetch me",
      createdAt: now,
      updatedAt: now,
    });

    const fetched = await repo.get(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.title).toBe("Fetch me");

    const missing = await repo.get(
      "00000000-0000-0000-0000-0000deadbeef"
    );
    expect(missing).toBeUndefined();
  });

  it("listByUser returns conversations sorted by updatedAt desc", async () => {
    const c1 = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      createdAt: 100,
      updatedAt: 100,
    });
    const c2 = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      createdAt: 200,
      updatedAt: 300,
    });
    const c3 = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      createdAt: 150,
      updatedAt: 200,
    });

    const result = await repo.listByUser(DEV_USER_ID);
    expect(result.map((c) => c.id)).toEqual([c2.id, c3.id, c1.id]);
  });

  it("updateTitle persists the new title, returns undefined for unknown id", async () => {
    const now = Date.now();
    const conv = await repo.create({
      workspaceId: DEV_WORKSPACE_ID,
      userId: DEV_USER_ID,
      title: "Old",
      createdAt: now,
      updatedAt: now,
    });

    const updated = await repo.updateTitle(conv.id, "New Title");
    expect(updated?.title).toBe("New Title");

    const refetched = await repo.get(conv.id);
    expect(refetched?.title).toBe("New Title");

    const missing = await repo.updateTitle(
      "00000000-0000-0000-0000-0000deadbeef",
      "x"
    );
    expect(missing).toBeUndefined();
  });
});
