import { eq, and, desc, asc } from "drizzle-orm";
import { providers, providerCatalogs, type DbClient } from "@ai-connect/db";

/**
 * Resolve a provider `kind` (e.g. "anthropic") to the id of the enabled provider
 * row the gateway would actually load for it.
 *
 * Must match the gateway's config source winner exactly: among enabled rows of
 * the same kind, newest `updatedAt` wins and `id` breaks clock-skew ties. If we
 * picked a different row, recorded `providerId` would point at a provider that
 * did not serve the turn.
 */
export type ResolveActiveProviderId = (kind: string) => Promise<string | null>;

export function createActiveProviderResolver(
  client: DbClient
): ResolveActiveProviderId {
  return async (kind: string): Promise<string | null> => {
    const [row] = await client.db
      .select({ id: providers.id })
      .from(providers)
      .innerJoin(
        providerCatalogs,
        eq(providers.catalogId, providerCatalogs.id)
      )
      .where(and(eq(providers.enabled, true), eq(providerCatalogs.name, kind)))
      // Newest updatedAt wins; id ascending breaks ties deterministically. This
      // mirrors the gateway's DbProviderConfigSource winner. Tie-breaks only
      // diverge if two enabled rows of one kind share an identical updatedAt
      // (SQL uuid order vs JS string compare) — rare, and only affects which
      // same-kind providerId is stamped, never the kind or token totals.
      .orderBy(desc(providers.updatedAt), asc(providers.id))
      .limit(1);
    return row?.id ?? null;
  };
}
