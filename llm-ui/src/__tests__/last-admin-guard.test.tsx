import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { MembersTab } from '@/components/admin/workspace/members-tab';
import { server } from '@/mocks/server';
import type { WsMemberRow } from '@/schemas/admin';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return { ...actual, useNavigate: () => vi.fn() };
});

const SINGLE_ADMIN: WsMemberRow[] = [
  {
    id: 'wm-only-admin',
    email: 'only-admin@demo.example',
    role: 'admin',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'wm-grace',
    email: 'grace@demo.example',
    role: 'member',
    joinedAt: '2026-02-01T00:00:00.000Z',
  },
];

const TWO_ADMINS: WsMemberRow[] = [
  {
    id: 'wm-admin-a',
    email: 'a@demo.example',
    role: 'admin',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'wm-admin-b',
    email: 'b@demo.example',
    role: 'admin',
    joinedAt: '2026-01-02T00:00:00.000Z',
  },
];

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function Wrapper({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Last-admin guard (BR-099)', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });
  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('disables role Select trigger and Remove button when the only admin remains', async () => {
    server.use(
      http.get('/api/admin/workspace/members', () =>
        HttpResponse.json({ members: SINGLE_ADMIN }),
      ),
    );
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <MembersTab />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(
        screen.getByText('only-admin@demo.example'),
      ).toBeInTheDocument(),
    );

    const roleTrigger = screen.getByRole('combobox', {
      name: 'Change role for only-admin@demo.example',
    });
    expect(roleTrigger).toBeDisabled();

    const removeButton = screen.getByTestId(
      'members-tab-remove-wm-only-admin',
    );
    expect(removeButton).toBeDisabled();
  });

  it('enables role Select trigger and Remove button when more than one admin exists', async () => {
    server.use(
      http.get('/api/admin/workspace/members', () =>
        HttpResponse.json({ members: TWO_ADMINS }),
      ),
    );
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <MembersTab />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText('a@demo.example')).toBeInTheDocument(),
    );

    const triggerA = screen.getByRole('combobox', {
      name: 'Change role for a@demo.example',
    });
    expect(triggerA).toBeEnabled();
    expect(
      screen.getByTestId('members-tab-remove-wm-admin-a'),
    ).toBeEnabled();
  });
});
