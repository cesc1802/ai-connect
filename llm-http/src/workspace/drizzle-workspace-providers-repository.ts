import { eq, and } from "drizzle-orm";
import {
  providers,
  providerCatalogs,
  workspaceProviders,
  type DbClient,
} from "@ai-connect/db";
import type {
  WorkspaceProviderRow,
  WorkspaceProvidersRepository,
} from "./workspace-providers-repository.js";
import { iconFromCatalogName } from "./provider-icon-map.js";

export class DrizzleWorkspaceProvidersRepository
  implements WorkspaceProvidersRepository
{
  constructor(private readonly client: DbClient) {}

  async listForWorkspace(workspaceId: string): Promise<WorkspaceProviderRow[]> {
    // Left-join workspace_providers so absent rows return enabled=false.
    const rows = await this.client.db
      .select({
        providerId: providers.id,
        alias: providers.alias,
        catalogName: providerCatalogs.name,
        enabled: workspaceProviders.enabled,
      })
      .from(providers)
      .innerJoin(providerCatalogs, eq(providers.catalogId, providerCatalogs.id))
      .leftJoin(
        workspaceProviders,
        and(
          eq(workspaceProviders.providerId, providers.id),
          eq(workspaceProviders.workspaceId, workspaceId)
        )
      );

    return rows.map((r) => ({
      providerId: r.providerId,
      name: r.catalogName,
      keyLabel: r.alias,
      icon: iconFromCatalogName(r.catalogName),
      // Absent row (null) means disabled; explicit false also disabled.
      enabled: r.enabled ?? false,
    }));
  }

  async setEnabled(
    workspaceId: string,
    providerId: string,
    enabled: boolean
  ): Promise<{ providerId: string; enabled: boolean } | null> {
    if (!(await this.providerExists(providerId))) return null;

    await this.client.db
      .insert(workspaceProviders)
      .values({ workspaceId, providerId, enabled })
      .onConflictDoUpdate({
        target: [workspaceProviders.workspaceId, workspaceProviders.providerId],
        set: { enabled, updatedAt: new Date() },
      });

    return { providerId, enabled };
  }

  async providerExists(providerId: string): Promise<boolean> {
    const [row] = await this.client.db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);
    return row !== undefined;
  }
}
