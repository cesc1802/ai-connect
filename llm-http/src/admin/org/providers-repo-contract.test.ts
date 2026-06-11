import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import {
  createDbClient,
  providers,
  providerCatalogs,
  workspaces,
  workspaceProviders,
  type DbClient,
} from "@ai-connect/db";
import {
  InMemoryProvidersRepository,
  type ProvidersRepository,
} from "./providers-repo.js";
import { DrizzleProvidersRepository } from "./drizzle-providers-repo.js";
import {
  ProviderDuplicateNameError,
  ProviderInUseError,
} from "./providers-service.js";

const ORG = "org-contract-test";
const NAME_PREFIX = "providers-contract-test-";

/**
 * Behavioral contract every ProvidersRepository implementation must satisfy.
 * Runs against in-memory always; against Drizzle when DATABASE_URL is set.
 */
function contractTests(getRepo: () => ProvidersRepository) {
  it("create round-trips all fields including baseUrl", async () => {
    const repo = getRepo();
    const created = await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}anthropic-main`,
      providerKind: "anthropic",
      encryptedKey: "aa:bb:cc",
      lastFour: "1234",
      baseUrl: "https://proxy.example.com/v1",
    });

    expect(created.id).toBeTruthy();
    expect(created.isEnabled).toBe(true);
    expect(created.baseUrl).toBe("https://proxy.example.com/v1");
    expect(created.lastFour).toBe("1234");
    expect(created.createdAt).toBeTruthy();

    const found = await repo.findById(ORG, created.id);
    expect(found).toMatchObject({
      id: created.id,
      displayName: `${NAME_PREFIX}anthropic-main`,
      providerKind: "anthropic",
      encryptedKey: "aa:bb:cc",
      lastFour: "1234",
      baseUrl: "https://proxy.example.com/v1",
      isEnabled: true,
    });
  });

  it("create without baseUrl yields null baseUrl", async () => {
    const repo = getRepo();
    const created = await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}openai-no-url`,
      providerKind: "openai",
      encryptedKey: "dd:ee:ff",
      lastFour: "9999",
    });
    expect(created.baseUrl).toBeNull();
  });

  it("accepts ollama kind without encryptedKey", async () => {
    const repo = getRepo();
    const created = await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}local-ollama`,
      providerKind: "ollama",
      encryptedKey: "",
      lastFour: "",
      baseUrl: "http://localhost:11434",
    });
    expect(created.providerKind).toBe("ollama");
    expect(created.encryptedKey).toBe("");
    expect(created.baseUrl).toBe("http://localhost:11434");
  });

  it("accepts minimax kind", async () => {
    const repo = getRepo();
    const created = await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}minimax-main`,
      providerKind: "minimax",
      encryptedKey: "11:22:33",
      lastFour: "abcd",
    });
    expect(created.providerKind).toBe("minimax");
  });

  it("findByOrgAndName matches case-insensitively with trim", async () => {
    const repo = getRepo();
    await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}MixedCase`,
      providerKind: "openai",
      encryptedKey: "aa:bb:cc",
      lastFour: "1234",
    });
    const found = await repo.findByOrgAndName(
      ORG,
      `  ${NAME_PREFIX}mixedcase  `,
    );
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe(`${NAME_PREFIX}MixedCase`);
  });

  it("update patches displayName, isEnabled, baseUrl and key fields", async () => {
    const repo = getRepo();
    const created = await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}to-update`,
      providerKind: "anthropic",
      encryptedKey: "aa:bb:cc",
      lastFour: "1234",
      baseUrl: "https://old.example.com",
    });

    const updated = await repo.update(ORG, created.id, {
      displayName: `${NAME_PREFIX}renamed`,
      isEnabled: false,
      encryptedKey: "dd:ee:ff",
      lastFour: "5678",
      baseUrl: "https://new.example.com",
    });

    expect(updated).toMatchObject({
      id: created.id,
      displayName: `${NAME_PREFIX}renamed`,
      isEnabled: false,
      encryptedKey: "dd:ee:ff",
      lastFour: "5678",
      baseUrl: "https://new.example.com",
      providerKind: "anthropic",
    });

    const found = await repo.findById(ORG, created.id);
    expect(found!.displayName).toBe(`${NAME_PREFIX}renamed`);
    expect(found!.isEnabled).toBe(false);
  });

  it("delete removes the row", async () => {
    const repo = getRepo();
    const created = await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}to-delete`,
      providerKind: "openai",
      encryptedKey: "aa:bb:cc",
      lastFour: "1234",
    });
    await repo.delete(ORG, created.id);
    expect(await repo.findById(ORG, created.id)).toBeNull();
  });

  it("listByOrg returns rows sorted by displayName", async () => {
    const repo = getRepo();
    await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}zeta`,
      providerKind: "openai",
      encryptedKey: "aa:bb:cc",
      lastFour: "1234",
    });
    await repo.create({
      orgId: ORG,
      displayName: `${NAME_PREFIX}alpha`,
      providerKind: "anthropic",
      encryptedKey: "dd:ee:ff",
      lastFour: "5678",
    });

    const rows = await repo.listByOrg(ORG);
    const ours = rows.filter((r) => r.displayName.startsWith(NAME_PREFIX));
    expect(ours.map((r) => r.displayName)).toEqual([
      `${NAME_PREFIX}alpha`,
      `${NAME_PREFIX}zeta`,
    ]);
  });
}

describe("ProvidersRepository contract", () => {
  describe("InMemoryProvidersRepository", () => {
    let repo: ProvidersRepository;
    beforeEach(() => {
      repo = new InMemoryProvidersRepository();
    });
    contractTests(() => repo);
  });

  const runIf = process.env.DATABASE_URL ? describe : describe.skip;

  runIf("DrizzleProvidersRepository", () => {
    let client: DbClient;
    let repo: ProvidersRepository;

    async function cleanup() {
      await client.db
        .delete(providers)
        .where(like(providers.alias, `${NAME_PREFIX}%`));
    }

    beforeAll(() => {
      client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
      repo = new DrizzleProvidersRepository(client);
    });

    afterAll(async () => {
      await cleanup();
      await client.close();
    });

    beforeEach(cleanup);

    contractTests(() => repo);

    it("reuses the catalog row on second create of the same kind", async () => {
      await repo.create({
        orgId: ORG,
        displayName: `${NAME_PREFIX}anthropic-one`,
        providerKind: "anthropic",
        encryptedKey: "aa:bb:cc",
        lastFour: "1111",
      });
      await repo.create({
        orgId: ORG,
        displayName: `${NAME_PREFIX}anthropic-two`,
        providerKind: "anthropic",
        encryptedKey: "dd:ee:ff",
        lastFour: "2222",
      });

      const catalogRows = await client.db
        .select()
        .from(providerCatalogs)
        .where(eq(providerCatalogs.name, "anthropic"));
      expect(catalogRows).toHaveLength(1);
    });

    it("delete of a workspace-bound provider throws ProviderInUseError", async () => {
      const created = await repo.create({
        orgId: ORG,
        displayName: `${NAME_PREFIX}bound-to-workspace`,
        providerKind: "openai",
        encryptedKey: "aa:bb:cc",
        lastFour: "1234",
      });
      const [ws] = await client.db
        .insert(workspaces)
        .values({ slug: `${NAME_PREFIX}ws`, name: "contract test ws" })
        .returning({ id: workspaces.id });
      await client.db.insert(workspaceProviders).values({
        workspaceId: ws!.id,
        providerId: created.id,
        enabled: false,
      });

      try {
        await expect(repo.delete(ORG, created.id)).rejects.toBeInstanceOf(
          ProviderInUseError,
        );
        // still present after the failed delete
        expect(await repo.findById(ORG, created.id)).not.toBeNull();
      } finally {
        await client.db
          .delete(workspaces)
          .where(like(workspaces.slug, `${NAME_PREFIX}%`));
      }
    });

    it("create with duplicate alias for same kind throws ProviderDuplicateNameError", async () => {
      const input = {
        orgId: ORG,
        displayName: `${NAME_PREFIX}dup-alias`,
        providerKind: "openai" as const,
        encryptedKey: "aa:bb:cc",
        lastFour: "1234",
      };
      await repo.create(input);
      await expect(repo.create(input)).rejects.toBeInstanceOf(
        ProviderDuplicateNameError,
      );
    });

    it("persists rows visible via a fresh repository instance", async () => {
      const created = await repo.create({
        orgId: ORG,
        displayName: `${NAME_PREFIX}survives-restart`,
        providerKind: "minimax",
        encryptedKey: "aa:bb:cc",
        lastFour: "4321",
        baseUrl: "https://api.minimax.example",
      });

      const freshRepo = new DrizzleProvidersRepository(client);
      const found = await freshRepo.findById(ORG, created.id);
      expect(found).not.toBeNull();
      expect(found!.displayName).toBe(`${NAME_PREFIX}survives-restart`);
      expect(found!.baseUrl).toBe("https://api.minimax.example");
    });
  });
});
