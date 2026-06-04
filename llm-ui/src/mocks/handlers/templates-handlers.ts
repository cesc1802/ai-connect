import { http, HttpResponse } from 'msw';
import { TEMPLATES_BY_WORKSPACE } from '../fixtures/templates';

export const templatesHandlers = [
  http.get('/api/workspaces/:workspaceId/templates', ({ params }) => {
    const id = String(params.workspaceId ?? '');
    return HttpResponse.json({ templates: TEMPLATES_BY_WORKSPACE[id] ?? [] });
  }),
];
