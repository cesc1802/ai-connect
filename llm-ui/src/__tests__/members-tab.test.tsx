import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import type { ReactNode } from 'react';

import { MembersTab } from '@/components/admin/workspace/members-tab';
import { server } from '@/mocks/server';
import { resetWsMembersHandlers } from '@/mocks/handlers/admin-ws-members-handlers';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

const navigateSpy = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

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

describe('MembersTab', () => {
  beforeEach(() => {
    resetWsMembersHandlers();
    navigateSpy.mockReset();
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('renders seeded members from the API', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <MembersTab />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument(),
    );
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();
    expect(screen.getByText('alan@demo.example')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Invite member' }),
    ).toBeEnabled();
  });

  it('opens invite dialog and submits a new member', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <MembersTab />
      </Wrapper>,
    );

    await screen.findByText('ada@demo.example');
    await user.click(
      screen.getByTestId('members-tab-invite-trigger'),
    );

    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Email'),
      'pat@demo.example',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Invite member' }),
    );

    await waitFor(() =>
      expect(screen.getByText('pat@demo.example')).toBeInTheDocument(),
    );
  });

  it('shows EmptyState when there are no members', async () => {
    server.use(
      http.get('/api/admin/workspace/members', () =>
        HttpResponse.json({ members: [] }),
      ),
    );
    const client = makeClient();
    const { container } = render(
      <Wrapper client={client}>
        <MembersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('No members yet')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);
  });

  it('is axe-clean in loaded state in both themes', async () => {
    const client = makeClient();
    const { container, rerender } = render(
      <Wrapper client={client}>
        <MembersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);

    rerender(
      <div className="dark">
        <Wrapper client={client}>
          <MembersTab />
        </Wrapper>
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});
