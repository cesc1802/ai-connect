import { apiFetch } from './client';
import {
  InviteOrgUserRequest,
  OrgUserListResponse,
  OrgUserRow,
} from '@/schemas/admin';

export async function listOrgUsers(): Promise<OrgUserListResponse> {
  return apiFetch('/admin/org/users', { method: 'GET' }, OrgUserListResponse);
}

export async function inviteOrgUser(
  input: InviteOrgUserRequest,
): Promise<OrgUserRow> {
  const body = InviteOrgUserRequest.parse(input);
  return apiFetch(
    '/admin/org/users/invite',
    { method: 'POST', body },
    OrgUserRow,
  );
}

export async function disableOrgUser(id: string): Promise<OrgUserRow> {
  return apiFetch(
    `/admin/org/users/${encodeURIComponent(id)}/disable`,
    { method: 'POST' },
    OrgUserRow,
  );
}
