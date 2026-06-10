export interface WorkspaceProviderRow {
  providerId: string;
  name: string;
  keyLabel: string;
  icon: string;
  enabled: boolean;
}

export interface WorkspaceProvidersRepository {
  /** List all org providers with the per-workspace enabled flag. Absent row = disabled. */
  listForWorkspace(workspaceId: string): Promise<WorkspaceProviderRow[]>;
  /**
   * Upsert the enabled flag for a provider in a workspace.
   * Returns the updated row, or null when the providerId does not exist.
   */
  setEnabled(
    workspaceId: string,
    providerId: string,
    enabled: boolean
  ): Promise<{ providerId: string; enabled: boolean } | null>;
  /** True when the given providerId exists in the providers table. */
  providerExists(providerId: string): Promise<boolean>;
}
