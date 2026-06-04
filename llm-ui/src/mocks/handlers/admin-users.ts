import { http, HttpResponse, delay } from 'msw';
import type { OrgUserRow } from '@/schemas/admin';

const DUPLICATE_EMAIL = 'dupe@example.com';

const seedUsers: OrgUserRow[] = [
  {
    id: 'u-ada',
    email: 'ada@demo.example',
    status: 'active',
    joinedAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'u-grace',
    email: 'grace@demo.example',
    status: 'pending',
    joinedAt: '2026-02-08T14:30:00.000Z',
  },
  {
    id: 'u-alan',
    email: 'alan@demo.example',
    status: 'disabled',
    joinedAt: '2025-11-20T11:15:00.000Z',
  },
];

let users: OrgUserRow[] = [...seedUsers];

export function resetOrgUserHandlers(): void {
  users = [...seedUsers];
}

export const adminUsersHandlers = [
  http.get('/api/admin/org/users', async () => {
    await delay(50);
    return HttpResponse.json({ users });
  }),

  http.post('/api/admin/org/users/invite', async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? '').trim();
    if (!email.includes('@')) {
      return HttpResponse.json(
        { code: 'invalid_body', message: 'Enter a valid email' },
        { status: 400 },
      );
    }
    if (email.toLowerCase() === DUPLICATE_EMAIL) {
      return HttpResponse.json(
        {
          code: 'duplicate_pending',
          message: 'Pending invite already exists for this email',
        },
        { status: 409 },
      );
    }
    const row: OrgUserRow = {
      id: `u-${Math.random().toString(36).slice(2, 8)}`,
      email,
      status: 'pending',
      joinedAt: new Date().toISOString(),
    };
    users = [...users, row];
    return HttpResponse.json(row, { status: 201 });
  }),

  http.post('/api/admin/org/users/:id/disable', async ({ params }) => {
    const { id } = params as { id: string };
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { code: 'user_not_found', message: 'User not found' },
        { status: 404 },
      );
    }
    const updated: OrgUserRow = { ...users[idx]!, status: 'disabled' };
    users = [...users.slice(0, idx), updated, ...users.slice(idx + 1)];
    return HttpResponse.json(updated);
  }),
];
