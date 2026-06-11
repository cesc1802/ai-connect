import { eq } from "drizzle-orm";
import { providers, providerCatalogs, type DbClient } from "@ai-connect/db";
import { PROVIDER_NAMES, type ProviderConfig, type ProviderConfigSource, type ProviderName } from "llm-gateway";
import type { Logger } from "../logger.js";
import type { ApiKeyVault } from "./api-key-vault.js";

/** Enabled provider row joined with its catalog kind, as needed by load(). */
export interface EnabledProviderRow {
  id: string;
  kind: string;
  baseUrl: string | null;
  apiKeyRef: string | null;
  updatedAt: Date;
}

// Kinds whose gateway config requires a decrypted API key.
const KEYED_KINDS = new Set<ProviderName>(["anthropic", "openai", "minimax"]);

/**
 * Map enabled provider rows to the gateway's ProviderConfig. One bad row
 * never fails the whole load: every skip is logged with a reason, and log
 * payloads carry row ids only — never key material.
 */
export function mapRowsToProviderConfig(
  rows: EnabledProviderRow[],
  vault: ApiKeyVault,
  logger: Logger
): ProviderConfig {
  const byKind = new Map<ProviderName, EnabledProviderRow[]>();
  for (const row of rows) {
    if (!(PROVIDER_NAMES as readonly string[]).includes(row.kind)) {
      logger.warn(
        { providerId: row.id, kind: row.kind },
        "Skipping provider: kind not supported by the gateway"
      );
      continue;
    }
    const kind = row.kind as ProviderName;
    const group = byKind.get(kind);
    if (group) group.push(row);
    else byKind.set(kind, [row]);
  }

  const config: ProviderConfig = {};
  for (const [kind, group] of byKind) {
    // Newest updatedAt wins; id breaks clock-skew ties deterministically.
    group.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id)
    );
    const winner = group[0]!;
    const losers = group.slice(1);
    if (losers.length > 0) {
      logger.warn(
        { kind, providerId: winner.id, skippedProviderIds: losers.map((l) => l.id) },
        "Multiple enabled providers for kind; using the most recently updated"
      );
    }

    if (kind === "ollama") {
      if (!winner.baseUrl) {
        logger.warn(
          { providerId: winner.id, kind },
          "Skipping ollama provider: base URL is required"
        );
        continue;
      }
      config.ollama = { baseUrl: winner.baseUrl };
      continue;
    }

    if (KEYED_KINDS.has(kind)) {
      if (!winner.apiKeyRef) {
        logger.warn({ providerId: winner.id, kind }, "Skipping provider: no API key stored");
        continue;
      }
      let apiKey: string;
      try {
        apiKey = vault.decrypt(winner.apiKeyRef);
      } catch {
        logger.warn(
          { providerId: winner.id, kind },
          "Skipping provider: stored API key failed to decrypt"
        );
        continue;
      }
      // The gateway does not validate source configs; never hand it an empty key.
      if (!apiKey) {
        logger.warn({ providerId: winner.id, kind }, "Skipping provider: stored API key is empty");
        continue;
      }
      const entry = { apiKey, ...(winner.baseUrl && { baseUrl: winner.baseUrl }) };
      if (kind === "anthropic") config.anthropic = entry;
      else if (kind === "openai") config.openai = entry;
      else config.minimax = entry;
    }
  }
  return config;
}

/**
 * ProviderConfigSource backed by the `providers` ⋈ `provider_catalogs`
 * tables: one query per load(), keys decrypted via ApiKeyVault.
 */
export class DbProviderConfigSource implements ProviderConfigSource {
  constructor(
    private readonly client: DbClient,
    private readonly vault: ApiKeyVault,
    private readonly logger: Logger
  ) {}

  async load(): Promise<ProviderConfig> {
    const rows = await this.client.db
      .select({
        id: providers.id,
        kind: providerCatalogs.name,
        baseUrl: providers.baseUrl,
        apiKeyRef: providers.apiKeyRef,
        updatedAt: providers.updatedAt,
      })
      .from(providers)
      .innerJoin(providerCatalogs, eq(providers.catalogId, providerCatalogs.id))
      .where(eq(providers.enabled, true));
    return mapRowsToProviderConfig(rows, this.vault, this.logger);
  }
}
