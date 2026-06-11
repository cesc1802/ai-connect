import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import {
  createDbClient,
  providers,
  type DbClient,
} from "@ai-connect/db";
import type { Logger } from "../logger.js";
import { ApiKeyVault } from "../admin/org/api-key-vault.js";
import { DrizzleProvidersRepository } from "../admin/org/drizzle-providers-repo.js";
import { OrgProvidersService } from "../admin/org/providers-service.js";
import {
  DbProviderConfigSource,
  mapRowsToProviderConfig,
  type EnabledProviderRow,
} from "./db-provider-config-source.js";

const NAME_PREFIX = "db-config-source-test-";

function fakeLogger(): { logger: Logger; warnCalls: () => unknown[][] } {
  const warn = vi.fn();
  return {
    logger: { warn } as unknown as Logger,
    warnCalls: () => warn.mock.calls,
  };
}

function row(overrides: Partial<EnabledProviderRow> & { kind: string }): EnabledProviderRow {
  return {
    id: overrides.id ?? "00000000-0000-0000-0000-000000000001",
    kind: overrides.kind,
    baseUrl: overrides.baseUrl ?? null,
    apiKeyRef: overrides.apiKeyRef ?? null,
    updatedAt: overrides.updatedAt ?? new Date("2026-06-11T00:00:00Z"),
  };
}

describe("mapRowsToProviderConfig", () => {
  let vault: ApiKeyVault;

  beforeEach(() => {
    vault = new ApiKeyVault({ NODE_ENV: "test" });
  });

  it("maps one row per supported kind with decrypted keys and baseUrl", () => {
    const { logger } = fakeLogger();
    const config = mapRowsToProviderConfig(
      [
        row({ id: "a1", kind: "anthropic", apiKeyRef: vault.encrypt("sk-ant-1") }),
        row({
          id: "o1",
          kind: "openai",
          apiKeyRef: vault.encrypt("sk-oai-1"),
          baseUrl: "https://proxy.example.com/v1",
        }),
        row({ id: "l1", kind: "ollama", baseUrl: "http://localhost:11434" }),
        row({ id: "m1", kind: "minimax", apiKeyRef: vault.encrypt("sk-mm-1") }),
      ],
      vault,
      logger
    );

    expect(config).toEqual({
      anthropic: { apiKey: "sk-ant-1" },
      openai: { apiKey: "sk-oai-1", baseUrl: "https://proxy.example.com/v1" },
      ollama: { baseUrl: "http://localhost:11434" },
      minimax: { apiKey: "sk-mm-1" },
    });
  });

  it("skips kinds the gateway does not support and warns", () => {
    const { logger, warnCalls } = fakeLogger();
    const config = mapRowsToProviderConfig(
      [row({ id: "g1", kind: "google", apiKeyRef: vault.encrypt("sk-goog-1") })],
      vault,
      logger
    );
    expect(config).toEqual({});
    expect(warnCalls()).toHaveLength(1);
    expect(JSON.stringify(warnCalls())).toContain("g1");
  });

  it("picks the newest updatedAt among duplicates of a kind and warns with loser ids", () => {
    const { logger, warnCalls } = fakeLogger();
    const config = mapRowsToProviderConfig(
      [
        row({
          id: "old1",
          kind: "anthropic",
          apiKeyRef: vault.encrypt("sk-old"),
          updatedAt: new Date("2026-06-10T00:00:00Z"),
        }),
        row({
          id: "new1",
          kind: "anthropic",
          apiKeyRef: vault.encrypt("sk-new"),
          updatedAt: new Date("2026-06-11T00:00:00Z"),
        }),
      ],
      vault,
      logger
    );
    expect(config.anthropic?.apiKey).toBe("sk-new");
    expect(JSON.stringify(warnCalls())).toContain("old1");
  });

  it("breaks updatedAt ties deterministically by id", () => {
    const { logger } = fakeLogger();
    const sameTime = new Date("2026-06-11T00:00:00Z");
    const rows = [
      row({ id: "bbb", kind: "openai", apiKeyRef: vault.encrypt("sk-b"), updatedAt: sameTime }),
      row({ id: "aaa", kind: "openai", apiKeyRef: vault.encrypt("sk-a"), updatedAt: sameTime }),
    ];
    const forward = mapRowsToProviderConfig(rows, vault, logger);
    const reversed = mapRowsToProviderConfig([...rows].reverse(), vault, logger);
    expect(forward.openai?.apiKey).toBe(reversed.openai?.apiKey);
  });

  it("skips ollama without baseUrl and warns", () => {
    const { logger, warnCalls } = fakeLogger();
    const config = mapRowsToProviderConfig([row({ id: "l1", kind: "ollama" })], vault, logger);
    expect(config).toEqual({});
    expect(warnCalls()).toHaveLength(1);
  });

  it("skips a keyed kind with no stored key and warns", () => {
    const { logger, warnCalls } = fakeLogger();
    const config = mapRowsToProviderConfig(
      [row({ id: "a1", kind: "anthropic", apiKeyRef: "" })],
      vault,
      logger
    );
    expect(config).toEqual({});
    expect(warnCalls()).toHaveLength(1);
  });

  it("skips a keyed kind whose stored key decrypts to an empty string", () => {
    const { logger, warnCalls } = fakeLogger();
    const config = mapRowsToProviderConfig(
      [row({ id: "e1", kind: "anthropic", apiKeyRef: vault.encrypt("") })],
      vault,
      logger
    );
    expect(config).toEqual({});
    expect(warnCalls()).toHaveLength(1);
  });

  it("skips a row whose key fails to decrypt but keeps the others", () => {
    const { logger, warnCalls } = fakeLogger();
    const config = mapRowsToProviderConfig(
      [
        row({ id: "bad1", kind: "anthropic", apiKeyRef: "not:valid:ciphertext" }),
        row({ id: "ok1", kind: "openai", apiKeyRef: vault.encrypt("sk-ok") }),
      ],
      vault,
      logger
    );
    expect(config.anthropic).toBeUndefined();
    expect(config.openai?.apiKey).toBe("sk-ok");
    expect(JSON.stringify(warnCalls())).toContain("bad1");
  });

  it("returns an empty config for no rows", () => {
    const { logger, warnCalls } = fakeLogger();
    expect(mapRowsToProviderConfig([], vault, logger)).toEqual({});
    expect(warnCalls()).toHaveLength(0);
  });

  it("never logs plaintext or ciphertext key material", () => {
    const { logger, warnCalls } = fakeLogger();
    const secrets = ["sk-plain-winner", "sk-plain-loser", "sk-plain-google"];
    const cipherLoser = vault.encrypt("sk-plain-loser");
    mapRowsToProviderConfig(
      [
        row({
          id: "w1",
          kind: "anthropic",
          apiKeyRef: vault.encrypt("sk-plain-winner"),
          updatedAt: new Date("2026-06-11T00:00:00Z"),
        }),
        row({
          id: "lz1",
          kind: "anthropic",
          apiKeyRef: cipherLoser,
          updatedAt: new Date("2026-06-10T00:00:00Z"),
        }),
        row({ id: "g1", kind: "google", apiKeyRef: vault.encrypt("sk-plain-google") }),
        row({ id: "bad1", kind: "openai", apiKeyRef: "corrupt:payload:here" }),
      ],
      vault,
      logger
    );
    const logged = JSON.stringify(warnCalls());
    for (const secret of secrets) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).not.toContain(cipherLoser);
  });
});

const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("DbProviderConfigSource (Postgres)", () => {
  let client: DbClient;
  let vault: ApiKeyVault;
  let repo: DrizzleProvidersRepository;

  async function cleanup() {
    await client.db.delete(providers).where(like(providers.alias, `${NAME_PREFIX}%`));
  }

  beforeAll(() => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    vault = new ApiKeyVault({ NODE_ENV: "test" });
    repo = new DrizzleProvidersRepository(client);
  });

  afterAll(async () => {
    await cleanup();
    await client.close();
  });

  beforeEach(cleanup);

  // Other suites running in parallel insert enabled rows of the same kinds;
  // a future updatedAt makes this test's row win the per-kind dedup.
  async function winDedup(providerId: string) {
    await client.db
      .update(providers)
      .set({ updatedAt: new Date(Date.now() + 3_600_000) })
      .where(eq(providers.id, providerId));
  }

  it("loads an enabled provider with its key decrypted", async () => {
    const created = await repo.create({
      orgId: "org-test",
      displayName: `${NAME_PREFIX}anthropic-main`,
      providerKind: "anthropic",
      encryptedKey: vault.encrypt("sk-db-secret-1"),
      lastFour: "et-1",
      baseUrl: "https://proxy.example.com",
    });
    await winDedup(created.id);

    const { logger } = fakeLogger();
    const source = new DbProviderConfigSource(client, vault, logger);
    const config = await source.load();

    expect(config.anthropic).toEqual({
      apiKey: "sk-db-secret-1",
      baseUrl: "https://proxy.example.com",
    });
  });

  it("excludes disabled providers from the load", async () => {
    const created = await repo.create({
      orgId: "org-test",
      displayName: `${NAME_PREFIX}minimax-disabled`,
      providerKind: "minimax",
      encryptedKey: vault.encrypt("sk-db-secret-2"),
      lastFour: "et-2",
    });
    await repo.update("org-test", created.id, { isEnabled: false });

    const { logger } = fakeLogger();
    const source = new DbProviderConfigSource(client, vault, logger);
    const config = await source.load();

    expect(config.minimax?.apiKey).not.toBe("sk-db-secret-2");
  });

  it("returns a provider created through the admin service", async () => {
    const audit = { emit: vi.fn().mockResolvedValue(undefined) };
    const { logger } = fakeLogger();
    const service = new OrgProvidersService(repo, vault, audit, logger);
    const wire = await service.add(
      { userId: "u-test", orgId: "org-test" },
      {
        displayName: `${NAME_PREFIX}openai-via-service`,
        providerKind: "openai",
        apiKey: "sk-via-service-3",
      }
    );
    await winDedup(wire.id);

    const source = new DbProviderConfigSource(client, vault, logger);
    const config = await source.load();
    expect(config.openai?.apiKey).toBe("sk-via-service-3");
  });
});
