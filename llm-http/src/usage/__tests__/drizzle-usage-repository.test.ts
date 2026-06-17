import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDbClient,
  usageMetrics,
  providers,
  providerCatalogs,
  type DbClient,
} from "@ai-connect/db";
import { DrizzleUsageRepository } from "../drizzle-usage-repository.js";
import { seedTestIdentity } from "../../conversations/__tests__/seed-test-identity.js";

// Dedicated identity so parallel cleanup never races other test files.
const WS_A = "00000000-0000-0000-0000-0000000000a1";
const WS_B = "00000000-0000-0000-0000-0000000000a2";
const USER_ID = "00000000-0000-0000-0000-0000000000b1";
const PROVIDER_ID = "00000000-0000-0000-0000-0000000000f1";

// Live DB tests; skipped unless DATABASE_URL points at a migrated Postgres.
const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DrizzleUsageRepository", () => {
  let client: DbClient;
  let repo: DrizzleUsageRepository;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    await seedTestIdentity(client, {
      workspaceId: WS_A,
      userId: USER_ID,
      slug: "usage-repo-test-a",
    });
    await seedTestIdentity(client, {
      workspaceId: WS_B,
      userId: USER_ID,
      slug: "usage-repo-test-b",
    });
    // A provider for non-null providerId attribution, referencing the
    // seeded "anthropic" catalog (catalogs are seeded by migration).
    const [catalog] = await client.db
      .select({ id: providerCatalogs.id })
      .from(providerCatalogs)
      .where(eq(providerCatalogs.name, "anthropic"))
      .limit(1);
    await client.db
      .insert(providers)
      .values({ id: PROVIDER_ID, catalogId: catalog!.id, alias: "usage-test-anthropic", enabled: true })
      .onConflictDoNothing();
    repo = new DrizzleUsageRepository(client);
  });

  afterEach(async () => {
    await client.db.delete(usageMetrics).where(eq(usageMetrics.userId, USER_ID));
  });

  afterAll(async () => {
    await client.db.delete(providers).where(eq(providers.id, PROVIDER_ID));
    await client.close();
  });

  async function record(
    overrides: Partial<Parameters<DrizzleUsageRepository["record"]>[0]> = {}
  ): Promise<void> {
    await repo.record({
      workspaceId: WS_A,
      userId: USER_ID,
      providerId: PROVIDER_ID,
      conversationId: null,
      providerKind: "anthropic",
      model: "claude-3",
      promptTokens: 100,
      completionTokens: 40,
      latencyMs: 1200,
      ...overrides,
    });
  }

  it("records a row and aggregates per provider with token split + count", async () => {
    await record();
    await record({ promptTokens: 50, completionTokens: 10 });

    const byProvider = await repo.aggregateByProvider("all");
    expect(byProvider).toHaveLength(1);
    expect(byProvider[0]).toMatchObject({
      providerId: PROVIDER_ID,
      providerKind: "anthropic",
      inputTokens: 150,
      outputTokens: 50,
      totalTokens: 200,
      requestCount: 2,
    });
  });

  it("aggregates per workspace", async () => {
    await record({ workspaceId: WS_A, promptTokens: 100, completionTokens: 20 });
    await record({ workspaceId: WS_B, promptTokens: 30, completionTokens: 5 });

    const byWorkspace = await repo.aggregateByWorkspace("all");
    const a = byWorkspace.find((w) => w.workspaceId === WS_A);
    const b = byWorkspace.find((w) => w.workspaceId === WS_B);
    expect(a).toMatchObject({ inputTokens: 100, outputTokens: 20, totalTokens: 120, requestCount: 1 });
    expect(b).toMatchObject({ inputTokens: 30, outputTokens: 5, totalTokens: 35, requestCount: 1 });
  });

  it("null providerId rows still aggregate by providerKind", async () => {
    await record({ providerId: null, providerKind: "ollama", promptTokens: 10, completionTokens: 2 });

    const byProvider = await repo.aggregateByProvider("all");
    const ollama = byProvider.find((p) => p.providerKind === "ollama");
    expect(ollama).toMatchObject({ providerId: null, inputTokens: 10, outputTokens: 2, requestCount: 1 });
  });

  it("scope by workspace ids restricts aggregation", async () => {
    await record({ workspaceId: WS_A });
    await record({ workspaceId: WS_B });

    const onlyB = await repo.aggregateByWorkspace([WS_B]);
    expect(onlyB).toHaveLength(1);
    expect(onlyB[0]?.workspaceId).toBe(WS_B);
  });

  it("empty scope yields no rows (member with no workspaces)", async () => {
    await record();
    expect(await repo.aggregateByProvider([])).toEqual([]);
    expect(await repo.aggregateByWorkspace([])).toEqual([]);
  });

  it("aggregation over empty set returns empty array, not null", async () => {
    expect(await repo.aggregateByProvider("all")).toEqual([]);
    expect(await repo.aggregateByWorkspace("all")).toEqual([]);
  });
});
