import { apiFetch } from './client';
import { WsRoleListResponse } from '@/schemas/admin';

export async function listWsRoles(): Promise<WsRoleListResponse> {
  return apiFetch(
    '/admin/workspace/roles',
    { method: 'GET' },
    WsRoleListResponse,
  );
}
