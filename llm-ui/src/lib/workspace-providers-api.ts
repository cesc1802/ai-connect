import { api } from "./api";

// Thin typed wrappers over /workspaces/:id/providers. `icon` is derived
// server-side from the provider catalog name; rows absent from
// workspace_providers arrive with enabled=false.

export interface WorkspaceProvider {
  providerId: string;
  name: string;
  keyLabel: string;
  icon: string;
  enabled: boolean;
}

export function listWorkspaceProviders(workspaceId: string): Promise<WorkspaceProvider[]> {
  return api
    .get<{ providers: WorkspaceProvider[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/providers`)
    .then((r) => r.providers);
}

export function setProviderEnabled(
  workspaceId: string,
  providerId: string,
  enabled: boolean,
): Promise<{ providerId: string; enabled: boolean }> {
  return api.patch<{ providerId: string; enabled: boolean }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/providers/${encodeURIComponent(providerId)}`,
    { enabled },
  );
}
