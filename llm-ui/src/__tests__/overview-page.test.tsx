import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { OverviewPage } from '@/pages/overview-page';
import { server } from '@/mocks/server';
import { resetOrgUserHandlers } from '@/mocks/handlers/admin-users';
import { resetOrgProviderHandlers } from '@/mocks/handlers/admin-org-providers-handlers';

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

describe('OverviewPage', () => {
  beforeEach(() => {
    resetOrgUserHandlers();
    resetOrgProviderHandlers();
  });

  it('renders the org hero with the Vietnamese tagline once data loads', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <OverviewPage />
      </Wrapper>,
    );

    const hero = await screen.findByRole('region', { name: 'Tổ chức' });
    expect(
      within(hero).getByRole('heading', { name: 'Công Ty ABC' }),
    ).toBeInTheDocument();
    expect(within(hero).getByText('Active')).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: /Mời thành viên/ })).toBeInTheDocument();
    expect(within(hero).getByRole('button', { name: /Billing/ })).toBeInTheDocument();
  });

  it('exposes the four stat cards with Vietnamese labels', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <OverviewPage />
      </Wrapper>,
    );

    const stats = await screen.findByRole('region', {
      name: 'Chỉ số tổng quan',
    });
    expect(within(stats).getByText('Thành viên')).toBeInTheDocument();
    expect(within(stats).getByText('Workspace')).toBeInTheDocument();
    expect(within(stats).getByText('Providers')).toBeInTheDocument();
    expect(within(stats).getByText('Prompt Templates')).toBeInTheDocument();
  });

  it('renders the role-breakdown region and the workspaces region', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <OverviewPage />
      </Wrapper>,
    );

    expect(
      await screen.findByRole('region', { name: 'Vai trò cấp tổ chức' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('region', { name: 'Workspaces' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('region', { name: 'Providers' }),
    ).toBeInTheDocument();
  });

  it('falls back to empty copy when MSW returns no workspaces and no providers', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: [] }),
      ),
      http.get('/api/admin/org/providers', () =>
        HttpResponse.json({ providers: [] }),
      ),
      http.get('/api/admin/org/templates', () =>
        HttpResponse.json({ templates: [] }),
      ),
    );
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <OverviewPage />
      </Wrapper>,
    );

    expect(
      await screen.findByText('Chưa có workspace nào.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Chưa kết nối provider.'),
    ).toBeInTheDocument();
  });
});
