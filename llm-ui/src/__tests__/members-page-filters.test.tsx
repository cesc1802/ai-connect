import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { MembersPage } from '@/pages/members-page';
import { resetOrgUserHandlers } from '@/mocks/handlers/admin-users';
import { resetWsMembersHandlers } from '@/mocks/handlers/admin-ws-members-handlers';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

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

describe('MembersPage filters & search', () => {
  beforeEach(() => {
    resetOrgUserHandlers();
    resetWsMembersHandlers();
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('renders Vietnamese page header and seeded members', async () => {
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    expect(
      screen.getByRole('heading', { name: 'Thành viên' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pool người dùng dùng chung toàn tổ chức/),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument(),
    );
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();
    expect(screen.getByText('alan@demo.example')).toBeInTheDocument();
  });

  it('filters by email search input (substring)', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await screen.findByText('ada@demo.example');

    const input = screen.getByTestId('members-search-input');
    await user.type(input, 'grace');

    await waitFor(() => {
      expect(screen.queryByText('ada@demo.example')).not.toBeInTheDocument();
    });
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();
    expect(screen.queryByText('alan@demo.example')).not.toBeInTheDocument();
  });

  it('filters by status chip', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await screen.findByText('ada@demo.example');

    // "Đang mời" = pending — only grace
    await user.click(
      screen.getByRole('button', { name: 'Đang mời', pressed: false }),
    );

    await waitFor(() => {
      expect(screen.queryByText('ada@demo.example')).not.toBeInTheDocument();
    });
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();
    expect(screen.queryByText('alan@demo.example')).not.toBeInTheDocument();

    // Switch back to "Tất cả"
    await user.click(
      screen.getByRole('button', { name: 'Tất cả', pressed: false }),
    );
    await waitFor(() =>
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument(),
    );
  });

  it('shows empty state when filter yields no rows', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await screen.findByText('ada@demo.example');
    await user.type(
      screen.getByTestId('members-search-input'),
      'no-such-user@example',
    );

    await waitFor(() =>
      expect(
        screen.getByText('Không tìm thấy thành viên'),
      ).toBeInTheDocument(),
    );
  });

  it('opens invite dialog from toolbar and reuses existing InviteUserDialog', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await screen.findByText('ada@demo.example');
    await user.click(screen.getByTestId('members-invite-trigger'));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Invite user' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
  });
});
