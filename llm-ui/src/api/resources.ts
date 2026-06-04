import { apiFetch } from './client';
import { WorkspaceResourcesResponse } from '@/schemas/resources';

export async function listWorkspaceResources(
  workspaceId: string,
): Promise<WorkspaceResourcesResponse> {
  return apiFetch(
    `/workspaces/${workspaceId}/resources`,
    { method: 'GET' },
    WorkspaceResourcesResponse,
  );
}
