import { http, HttpResponse, delay } from 'msw';
import { DEMO_CONVERSATIONS } from '../fixtures/conversations';

export const conversationHandlers = [
  http.get('/api/conversations', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const conversations = workspaceId
      ? DEMO_CONVERSATIONS.filter((c) => c.workspaceId === workspaceId)
      : DEMO_CONVERSATIONS;
    return HttpResponse.json({ conversations });
  }),

  http.get('/api/conversations/:id/messages', async ({ params }) => {
    await delay(150);
    const id = String(params.id);
    return HttpResponse.json({
      messages: [
        {
          id: `${id}_msg_001`,
          conversationId: id,
          role: 'user',
          content: 'Hello!',
          createdAt: '2026-06-01T09:00:00.000Z',
        },
        {
          id: `${id}_msg_002`,
          conversationId: id,
          role: 'assistant',
          content: 'Hi there — how can I help today?',
          createdAt: '2026-06-01T09:00:02.000Z',
        },
      ],
    });
  }),
];
