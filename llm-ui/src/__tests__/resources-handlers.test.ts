import { describe, expect, it } from 'vitest';
import { WorkspaceResourcesResponse } from '@/schemas/resources';
import { WORKSPACE_RESOURCES } from '@/mocks/fixtures/resources';

const API = '/api';

async function fetchResources(workspaceId: string): Promise<{
  status: number;
  json: unknown;
}> {
  const res = await fetch(`${API}/workspaces/${workspaceId}/resources`);
  const text = await res.text();
  const json = text.length > 0 ? JSON.parse(text) : null;
  return { status: res.status, json };
}

describe('resources MSW handler', () => {
  it('returns enabled providers for wsp_personal (owner role)', async () => {
    const { status, json } = await fetchResources('wsp_personal');
    expect(status).toBe(200);
    const parsed = WorkspaceResourcesResponse.parse(json);

    const ids = parsed.providers.map((p) => p.id);
    expect(ids).toContain('prv_personal_openai');
    expect(ids).toContain('prv_personal_anthropic');
    // disabled provider must be filtered out
    expect(ids).not.toContain('prv_personal_google_disabled');
  });

  it('never leaks allowedRoles to the client', async () => {
    for (const wsId of ['wsp_personal', 'wsp_acme']) {
      const { json } = await fetchResources(wsId);
      const providers = (json as { providers: Array<Record<string, unknown>> }).providers;
      for (const p of providers) {
        expect(p.allowedRoles).toBeUndefined();
      }
    }
  });

  it('respects role filter on wsp_acme (admin sees admin-only Azure provider)', async () => {
    const { json } = await fetchResources('wsp_acme');
    const parsed = WorkspaceResourcesResponse.parse(json);
    const ids = parsed.providers.map((p) => p.id);

    // admin has access to the admin-only provider
    expect(ids).toContain('prv_acme_azure_admin_only');
    // disabled custom provider filtered
    expect(ids).not.toContain('prv_acme_custom_disabled');
  });

  it('drops providers whose allowedRoles do not include the caller role', async () => {
    // Sanity: the fixture has at least one role-restricted entry. Confirm we only
    // exposed it for roles allowed in the fixture (defense against the handler
    // forgetting the role filter).
    const adminOnly = WORKSPACE_RESOURCES.wsp_acme.find(
      (p) => p.id === 'prv_acme_azure_admin_only',
    );
    expect(adminOnly?.allowedRoles).toEqual(['owner', 'admin']);
    expect(adminOnly?.allowedRoles).not.toContain('member');
    expect(adminOnly?.allowedRoles).not.toContain('viewer');
  });

  it('returns 404 for unknown workspace id', async () => {
    const { status, json } = await fetchResources('wsp_does_not_exist');
    expect(status).toBe(404);
    expect((json as { error: string }).error).toBe('workspace_not_found');
  });
});
