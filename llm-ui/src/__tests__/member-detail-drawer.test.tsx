import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { MembersPage } from '@/pages/members-page';
import { server } from '@/mocks/server';
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

describe('MemberDetailDrawer', () => {
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

  it('opens drawer with member email and "Hồ sơ thành viên" header on row click', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await user.click(await screen.findByTestId('members-row-trigger-u-ada'));

    const drawer = await screen.findByRole('dialog');
    expect(
      within(drawer).getByText('Hồ sơ thành viên'),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('ada@demo.example')).toBeInTheDocument();
    expect(
      within(drawer).getByText('Vai trò theo workspace'),
    ).toBeInTheDocument();
  });

  it('shows "Chưa tham gia workspace nào" when user has no workspace memberships', async () => {
    // alan is disabled; ws-members handler has no row with id "u-alan"
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await user.click(await screen.findByTestId('members-row-trigger-u-alan'));

    await waitFor(() =>
      expect(
        screen.getByText('Chưa tham gia workspace nào.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId('member-detail-ws-count')).toHaveTextContent(
      '0 workspace',
    );
  });

  it('renders membership when ws-members and org-users share an id', async () => {
    server.use(
      http.get('/api/admin/workspace/members', () =>
        HttpResponse.json({
          members: [
            {
              id: 'u-ada',
              email: 'ada@demo.example',
              role: 'admin',
              joinedAt: '2026-01-15T09:00:00.000Z',
            },
          ],
        }),
      ),
    );

    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await user.click(await screen.findByTestId('members-row-trigger-u-ada'));

    await waitFor(() =>
      expect(screen.getByTestId('member-detail-ws-count')).toHaveTextContent(
        '1 workspace',
      ),
    );
  });

  it('renders "Thêm vào workspace" link with userId query param', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await user.click(await screen.findByTestId('members-row-trigger-u-ada'));

    const link = await screen.findByTestId('member-detail-assign-link');
    expect(link).toHaveAttribute(
      'href',
      '/admin/org/assignment?user=u-ada',
    );
  });

  it('triggers disable confirm dialog from drawer footer', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper client={makeClient()}>
        <MembersPage />
      </Wrapper>,
    );

    await user.click(await screen.findByTestId('members-row-trigger-u-ada'));
    await user.click(await screen.findByTestId('member-detail-disable'));

    await waitFor(() =>
      expect(screen.getByText('Disable ada@demo.example?')).toBeInTheDocument(),
    );
  });
});
