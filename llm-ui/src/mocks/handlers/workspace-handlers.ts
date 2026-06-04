import { http, HttpResponse, delay } from 'msw';
import { DEMO_WORKSPACES } from '../fixtures/workspaces';

export const workspaceHandlers = [
  http.get('/api/workspaces', async () => {
    await delay(200);
    return HttpResponse.json({ workspaces: DEMO_WORKSPACES });
  }),
];
