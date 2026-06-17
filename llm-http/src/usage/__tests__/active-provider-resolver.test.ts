import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  providers,
  providerCatalogs,
  type DbClient,
} from "@ai-connect/db";
import { createActiveProviderResolver } from "../active-provider-resolver.js";

// A dedicated catalog kind nothing else seeds or inserts, so "newest wins"
// assertions are not raced by other DB suites that touch shared provider kinds.
const KIND = "usage-resolver-test-kind";
const CATALOG_ID = "00000000-0000-0000-0000-0000000000e2";
const OLD_ID = "00000000-0000-0000-0000-0000000000f2";
const NEW_ID = "00000000-0000-0000-0000-0000000000f3";

// Live DB tests; skipped unless DATABASE_URL points at a migrated Postgres.
const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("active-provider-resolver", () => {
  let client: DbClient;
  let resolve: (kind: string) => Promise<string | null>;

  beforeAll(async () => {
    client = createDbClient({ url: process.env.DATABASE_URL!, poolMax: 2 });
    await client.db
      .insert(providerCatalogs)
      .values({ id: CATALOG_ID, name: KIND, host: "http://localhost" })
      .onConflictDoNothing();
    resolve = createActiveProviderResolver(client);
  });

  afterEach(async () => {
    await client.db.delete(providers).where(inArray(providers.id, [OLD_ID, NEW_ID]));
  });

  afterAll(async () => {
    await client.db.delete(providers).where(eq(providers.catalogId, CATALOG_ID));
    await client.db.delete(providerCatalogs).where(eq(providerCatalogs.id, CATALOG_ID));
    await client.close();
  });

  it("returns null when no enabled provider of that kind exists", async () => {
    expect(await resolve(KIND)).toBeNull();
  });

  it("returns the only enabled provider id for the kind", async () => {
    await client.db
      .insert(providers)
      .values({ id: OLD_ID, catalogId: CATALOG_ID, alias: "res-1", enabled: true });
    expect(await resolve(KIND)).toBe(OLD_ID);
  });

  it("newest updatedAt wins among multiple enabled providers", async () => {
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();
    await client.db
      .insert(providers)
      .values({ id: OLD_ID, catalogId: CATALOG_ID, alias: "res-old", enabled: true, updatedAt: older });
    await client.db
      .insert(providers)
      .values({ id: NEW_ID, catalogId: CATALOG_ID, alias: "res-new", enabled: true, updatedAt: newer });
    expect(await resolve(KIND)).toBe(NEW_ID);
  });

  it("ignores disabled providers", async () => {
    await client.db
      .insert(providers)
      .values({ id: OLD_ID, catalogId: CATALOG_ID, alias: "res-off", enabled: false });
    expect(await resolve(KIND)).toBeNull();
  });
});
