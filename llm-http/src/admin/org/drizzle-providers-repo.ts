import { asc, eq, sql } from "drizzle-orm";
import {
  providers,
  providerCatalogs,
  type DbClient,
} from "@ai-connect/db";
import type { ProviderKind } from "./provider-kind.js";
import type {
  CreateProviderInput,
  ProviderCatalogEntry,
  ProviderScope,
  ProvidersRepository,
  StoredProvider,
  UpdateProviderPatch,
} from "./providers-repo.js";
import {
  ProviderDuplicateNameError,
  ProviderInUseError,
} from "./providers-service.js";

// PostgreSQL SQLSTATE codes surfaced by the postgres.js driver.
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

// Default API hosts recorded on the catalog row when a kind is first used.
const CATALOG_HOSTS: Record<ProviderKind, string> = {
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
  "azure-openai": "",
  ollama: "http://localhost:11434",
  minimax: "https://api.minimax.io",
  custom: "",
};

interface JoinedRow {
  id: string;
  alias: string;
  kind: string;
  baseUrl: string | null;
  apiKeyRef: string | null;
  lastFour: string;
  enabled: boolean;
  defaultModel: string | null;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Postgres-backed ProvidersRepository over `providers` ⋈ `provider_catalogs`.
 * The `orgId` parameter is accepted for interface compatibility but not
 * filtered on: the schema has no org column — this deployment is single-org.
 */
export class DrizzleProvidersRepository implements ProvidersRepository {
  constructor(private readonly client: DbClient) {}

  private joinedSelect() {
    return this.client.db
      .select({
        id: providers.id,
        alias: providers.alias,
        kind: providerCatalogs.name,
        baseUrl: providers.baseUrl,
        apiKeyRef: providers.apiKeyRef,
        lastFour: providers.lastFour,
        enabled: providers.enabled,
        defaultModel: providers.defaultModel,
        scope: providers.scope,
        createdAt: providers.createdAt,
        updatedAt: providers.updatedAt,
      })
      .from(providers)
      .innerJoin(providerCatalogs, eq(providers.catalogId, providerCatalogs.id));
  }

  async listByOrg(orgId: string): Promise<StoredProvider[]> {
    const rows = await this.joinedSelect().orderBy(asc(providers.alias));
    return rows.map((r) => toStored(r, orgId));
  }

  async findById(orgId: string, id: string): Promise<StoredProvider | null> {
    const rows = await this.joinedSelect().where(eq(providers.id, id)).limit(1);
    const row = rows[0];
    return row ? toStored(row, orgId) : null;
  }

  async findByOrgAndName(
    orgId: string,
    displayName: string,
  ): Promise<StoredProvider | null> {
    const normalized = displayName.trim().toLowerCase();
    const rows = await this.joinedSelect()
      .where(sql`lower(trim(${providers.alias})) = ${normalized}`)
      .limit(1);
    const row = rows[0];
    return row ? toStored(row, orgId) : null;
  }

  async create(input: CreateProviderInput): Promise<StoredProvider> {
    let row;
    try {
      row = await this.client.db.transaction(async (tx) => {
        const catalogId = await getOrCreateCatalog(tx, input.providerKind);
        const inserted = await tx
          .insert(providers)
          .values({
            catalogId,
            alias: input.displayName,
            baseUrl: input.baseUrl ?? null,
            apiKeyRef: input.encryptedKey,
            lastFour: input.lastFour,
            enabled: true,
            defaultModel: input.defaultModel ?? null,
            scope: input.scope ?? "org",
          })
          .returning();
        return inserted[0]!;
      });
    } catch (err) {
      // Concurrent create raced past the service's duplicate-name pre-check;
      // the unique(catalog_id, alias) constraint is the backstop.
      if (pgCode(err) === PG_UNIQUE_VIOLATION) {
        throw new ProviderDuplicateNameError(input.displayName);
      }
      throw err;
    }

    return toStored(
      {
        id: row.id,
        alias: row.alias,
        kind: input.providerKind,
        baseUrl: row.baseUrl,
        apiKeyRef: row.apiKeyRef,
        lastFour: row.lastFour,
        enabled: row.enabled,
        defaultModel: row.defaultModel,
        scope: row.scope,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      input.orgId,
    );
  }

  async update(
    orgId: string,
    id: string,
    patch: UpdateProviderPatch,
  ): Promise<StoredProvider> {
    let updated;
    try {
      updated = await this.client.db
        .update(providers)
        .set({
          ...(patch.displayName !== undefined && { alias: patch.displayName }),
          ...(patch.isEnabled !== undefined && { enabled: patch.isEnabled }),
          ...(patch.encryptedKey !== undefined && { apiKeyRef: patch.encryptedKey }),
          ...(patch.lastFour !== undefined && { lastFour: patch.lastFour }),
          ...(patch.baseUrl !== undefined && { baseUrl: patch.baseUrl }),
          ...(patch.defaultModel !== undefined && { defaultModel: patch.defaultModel }),
          ...(patch.scope !== undefined && { scope: patch.scope }),
          updatedAt: new Date(),
        })
        .where(eq(providers.id, id))
        .returning({ id: providers.id });
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION && patch.displayName) {
        throw new ProviderDuplicateNameError(patch.displayName);
      }
      throw err;
    }

    if (updated.length === 0) throw new Error(`provider ${id} not found`);
    const found = await this.findById(orgId, id);
    if (!found) throw new Error(`provider ${id} not found`);
    return found;
  }

  async delete(_orgId: string, id: string): Promise<void> {
    let deleted;
    try {
      deleted = await this.client.db
        .delete(providers)
        .where(eq(providers.id, id))
        .returning({ id: providers.id });
    } catch (err) {
      // workspace_providers.provider_id is ON DELETE RESTRICT: a provider
      // referenced by any workspace binding cannot be hard-deleted.
      if (pgCode(err) === PG_FOREIGN_KEY_VIOLATION) {
        throw new ProviderInUseError(id);
      }
      throw err;
    }
    if (deleted.length === 0) throw new Error(`provider ${id} not found`);
  }

  async listCatalog(): Promise<ProviderCatalogEntry[]> {
    return this.client.db
      .select({
        name: providerCatalogs.name,
        host: providerCatalogs.host,
        models: providerCatalogs.models,
      })
      .from(providerCatalogs)
      .orderBy(asc(providerCatalogs.name));
  }
}

type Tx = Parameters<Parameters<DbClient["db"]["transaction"]>[0]>[0];

/** Get-or-create the catalog row for a kind; race-safe via the unique(name) constraint. */
async function getOrCreateCatalog(tx: Tx, kind: ProviderKind): Promise<string> {
  const inserted = await tx
    .insert(providerCatalogs)
    .values({ name: kind, host: CATALOG_HOSTS[kind] })
    .onConflictDoNothing({ target: providerCatalogs.name })
    .returning({ id: providerCatalogs.id });
  if (inserted[0]) return inserted[0].id;

  const existing = await tx
    .select({ id: providerCatalogs.id })
    .from(providerCatalogs)
    .where(eq(providerCatalogs.name, kind))
    .limit(1);
  if (!existing[0]) throw new Error(`catalog row for kind "${kind}" not found`);
  return existing[0].id;
}

function toStored(row: JoinedRow, orgId: string): StoredProvider {
  return {
    id: row.id,
    orgId,
    displayName: row.alias,
    providerKind: row.kind as ProviderKind,
    isEnabled: row.enabled,
    encryptedKey: row.apiKeyRef ?? "",
    lastFour: row.lastFour,
    baseUrl: row.baseUrl,
    defaultModel: row.defaultModel,
    scope: row.scope === "select" ? "select" : ("org" satisfies ProviderScope),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
