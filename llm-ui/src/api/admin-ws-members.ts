import { apiFetch } from './client';
import {
  ChangeWsMemberRoleRequest,
  InviteWsMemberRequest,
  WsMemberListResponse,
  WsMemberRow,
} from '@/schemas/admin';

export async function listWsMembers(): Promise<WsMemberListResponse> {
  return apiFetch(
    '/admin/workspace/members',
    { method: 'GET' },
    WsMemberListResponse,
  );
}

export async function inviteWsMember(
  input: InviteWsMemberRequest,
): Promise<WsMemberRow> {
  const body = InviteWsMemberRequest.parse(input);
  return apiFetch(
    '/admin/workspace/members/invite',
    { method: 'POST', body },
    WsMemberRow,
  );
}

export async function changeWsMemberRole(
  id: string,
  input: ChangeWsMemberRoleRequest,
): Promise<WsMemberRow> {
  const body = ChangeWsMemberRoleRequest.parse(input);
  return apiFetch(
    `/admin/workspace/members/${encodeURIComponent(id)}`,
    { method: 'PATCH', body },
    WsMemberRow,
  );
}

export async function removeWsMember(id: string): Promise<WsMemberRow> {
  return apiFetch(
    `/admin/workspace/members/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    WsMemberRow,
  );
}
