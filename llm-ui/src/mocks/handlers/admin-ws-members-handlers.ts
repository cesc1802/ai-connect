import { http, HttpResponse, delay } from 'msw';
import type { WsMemberRow } from '@/schemas/admin';
import type { WorkspaceRole } from '@/schemas/auth';
import { LAST_ADMIN_CODE } from '@/schemas/admin';

const DUPLICATE_EMAIL = 'dupe@example.com';

const seedMembers: WsMemberRow[] = [
  {
    id: 'wm-ada',
    email: 'ada@demo.example',
    role: 'admin',
    joinedAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'wm-grace',
    email: 'grace@demo.example',
    role: 'member',
    joinedAt: '2026-02-08T14:30:00.000Z',
  },
  {
    id: 'wm-alan',
    email: 'alan@demo.example',
    role: 'viewer',
    joinedAt: '2025-11-20T11:15:00.000Z',
  },
];

let members: WsMemberRow[] = [...seedMembers];

function countAdmins(): number {
  return members.filter((m) => m.role === 'admin').length;
}

export function resetWsMembersHandlers(): void {
  members = [...seedMembers];
}

export function getWsMembersSnapshot(): WsMemberRow[] {
  return [...members];
}

export const adminWsMembersHandlers = [
  http.get('/api/admin/workspace/members', async () => {
    await delay(50);
    return HttpResponse.json({ members });
  }),

  http.post('/api/admin/workspace/members/invite', async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      role?: WorkspaceRole;
    };
    const email = (body.email ?? '').trim();
    const role = (body.role ?? 'member') as WorkspaceRole;
    if (!email.includes('@')) {
      return HttpResponse.json(
        { error: 'invalid_body', message: 'Enter a valid email' },
        { status: 400 },
      );
    }
    if (email.toLowerCase() === DUPLICATE_EMAIL) {
      return HttpResponse.json(
        { error: 'conflict', message: 'Member already exists' },
        { status: 409 },
      );
    }
    const row: WsMemberRow = {
      id: `wm-${Math.random().toString(36).slice(2, 8)}`,
      email,
      role,
      joinedAt: new Date().toISOString(),
    };
    members = [...members, row];
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch('/api/admin/workspace/members/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as { role?: WorkspaceRole };
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { error: 'not_found', message: 'Member not found' },
        { status: 404 },
      );
    }
    const current = members[idx]!;
    const nextRole = (body.role ?? current.role) as WorkspaceRole;
    if (
      current.role === 'admin' &&
      nextRole !== 'admin' &&
      countAdmins() <= 1
    ) {
      return HttpResponse.json(
        {
          error: 'unprocessable_entity',
          code: LAST_ADMIN_CODE,
          message: 'A workspace must always have at least one Admin.',
        },
        { status: 422 },
      );
    }
    const updated: WsMemberRow = { ...current, role: nextRole };
    members = [...members.slice(0, idx), updated, ...members.slice(idx + 1)];
    return HttpResponse.json(updated);
  }),

  http.delete('/api/admin/workspace/members/:id', async ({ params }) => {
    const { id } = params as { id: string };
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { error: 'not_found', message: 'Member not found' },
        { status: 404 },
      );
    }
    const current = members[idx]!;
    if (current.role === 'admin' && countAdmins() <= 1) {
      return HttpResponse.json(
        {
          error: 'unprocessable_entity',
          code: LAST_ADMIN_CODE,
          message: 'A workspace must always have at least one Admin.',
        },
        { status: 422 },
      );
    }
    members = [...members.slice(0, idx), ...members.slice(idx + 1)];
    return HttpResponse.json(current);
  }),
];
