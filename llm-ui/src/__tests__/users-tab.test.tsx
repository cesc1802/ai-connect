import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import type { ReactNode } from 'react';

import { UsersTab } from '@/components/admin/org/users-tab';
import { server } from '@/mocks/server';
import { resetOrgUserHandlers } from '@/mocks/handlers/admin-users';

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

async function expectNoSeriousAxe(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

describe('UsersTab — loaded state', () => {
  it('renders users returned from the API', async () => {
    resetOrgUserHandlers();
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <UsersTab />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument(),
    );
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();
    expect(screen.getByText('alan@demo.example')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite user' })).toBeEnabled();
  });

  it('is axe-clean in loaded state in both themes', async () => {
    resetOrgUserHandlers();
    const client = makeClient();
    const { container, rerender } = render(
      <Wrapper client={client}>
        <UsersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);

    rerender(
      <div className="dark">
        <Wrapper client={client}>
          <UsersTab />
        </Wrapper>
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});

describe('UsersTab — empty state', () => {
  it('shows the EmptyState heading when there are no users', async () => {
    server.use(
      http.get('/api/admin/org/users', () =>
        HttpResponse.json({ users: [] }),
      ),
    );
    const client = makeClient();
    const { container } = render(
      <Wrapper client={client}>
        <UsersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('No users yet')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);
  });
});
