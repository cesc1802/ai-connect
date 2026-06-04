import { apiFetch } from './client';
import { TemplateListResponse } from '@/schemas/template';

/**
 * Member-facing template list. Contract is UI-defined — backend will catch up.
 * Scope tags drive the three sidebar groups (suggested/workspace/personal),
 * `role` opts a template into the suggested group for a workspace role.
 */
export async function listTemplates(
  workspaceId: string,
): Promise<TemplateListResponse> {
  return apiFetch(
    `/workspaces/${encodeURIComponent(workspaceId)}/templates`,
    { method: 'GET' },
    TemplateListResponse,
  );
}
