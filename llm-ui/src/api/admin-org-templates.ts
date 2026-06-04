import { apiFetch } from './client';
import { ApiError } from './errors';
import {
  OrgTemplateListResponse,
  OrgTemplateRow,
  type OrgTemplateCreateRequest,
  type OrgTemplateUpdateRequest,
} from '@/schemas/admin';
import { z } from 'zod';

export class TemplateNameConflictError extends Error {
  constructor() {
    super('A template with this name already exists');
    this.name = 'TemplateNameConflictError';
  }
}

function asConflict(err: unknown): never {
  if (err instanceof ApiError && err.status === 409) {
    throw new TemplateNameConflictError();
  }
  throw err;
}

export async function listOrgTemplates(): Promise<OrgTemplateListResponse> {
  return apiFetch('/admin/org/templates', { method: 'GET' }, OrgTemplateListResponse);
}

export async function createOrgTemplate(
  body: OrgTemplateCreateRequest,
): Promise<OrgTemplateRow> {
  try {
    return await apiFetch(
      '/admin/org/templates',
      { method: 'POST', body },
      OrgTemplateRow,
    );
  } catch (err) {
    asConflict(err);
  }
}

export async function updateOrgTemplate(
  id: string,
  body: OrgTemplateUpdateRequest,
): Promise<OrgTemplateRow> {
  try {
    return await apiFetch(
      `/admin/org/templates/${encodeURIComponent(id)}`,
      { method: 'PATCH', body },
      OrgTemplateRow,
    );
  } catch (err) {
    asConflict(err);
  }
}

export async function deleteOrgTemplate(id: string): Promise<void> {
  await apiFetch(
    `/admin/org/templates/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    z.unknown(),
  );
}
