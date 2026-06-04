import { http, HttpResponse, delay } from 'msw';
import { DEMO_WORKSPACES } from '../fixtures/workspaces';
import { WORKSPACE_RESOURCES } from '../fixtures/resources';
import type { Provider } from '@/schemas/resources';

export const resourcesHandlers = [
  http.get('/api/workspaces/:workspaceId/resources', async ({ params }) => {
    await delay(150);
    const { workspaceId } = params as { workspaceId: string };
    const workspace = DEMO_WORKSPACES.find((w) => w.id === workspaceId);
    if (!workspace) {
      return HttpResponse.json({ error: 'workspace_not_found' }, { status: 404 });
    }
    const role = workspace.role;
    const fixtures = WORKSPACE_RESOURCES[workspaceId] ?? [];
    const providers: Provider[] = fixtures
      .filter((p) => p.isEnabled && p.allowedRoles.includes(role))
      .map(({ allowedRoles: _allowedRoles, ...rest }) => rest);
    return HttpResponse.json({ providers });
  }),
];
