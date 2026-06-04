import { apiFetch } from './client';
import {
  OrgProvidersResponse,
  OrgProviderResponse,
  type AddOrgProviderRequest,
  type UpdateOrgProviderRequest,
  type RotateOrgProviderKeyRequest,
} from '@/schemas/admin';
import { z } from 'zod';

const EmptyResponse = z.unknown();

export async function listOrgProviders(): Promise<OrgProvidersResponse> {
  return apiFetch('/admin/org/providers', { method: 'GET' }, OrgProvidersResponse);
}

export async function addOrgProvider(
  body: AddOrgProviderRequest,
): Promise<OrgProviderResponse> {
  return apiFetch(
    '/admin/org/providers',
    { method: 'POST', body },
    OrgProviderResponse,
  );
}

export async function updateOrgProvider(
  id: string,
  body: UpdateOrgProviderRequest,
): Promise<OrgProviderResponse> {
  return apiFetch(
    `/admin/org/providers/${encodeURIComponent(id)}`,
    { method: 'PATCH', body },
    OrgProviderResponse,
  );
}

export async function rotateOrgProviderKey(
  id: string,
  body: RotateOrgProviderKeyRequest,
): Promise<OrgProviderResponse> {
  return apiFetch(
    `/admin/org/providers/${encodeURIComponent(id)}/rotate-key`,
    { method: 'POST', body },
    OrgProviderResponse,
  );
}

export async function deleteOrgProvider(id: string): Promise<void> {
  await apiFetch(
    `/admin/org/providers/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    EmptyResponse,
  );
}
