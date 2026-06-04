import { apiFetch } from './client';
import { WorkspaceListResponse } from '@/schemas/workspace';

export async function listWorkspaces(): Promise<WorkspaceListResponse> {
  return apiFetch('/workspaces', { method: 'GET' }, WorkspaceListResponse);
}
