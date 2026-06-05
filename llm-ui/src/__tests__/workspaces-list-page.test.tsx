import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';

import { WorkspacesListPage } from '@/pages/workspaces-list-page';
import { server } from '@/mocks/server';
import { DEMO_WORKSPACES } from '@/mocks/fixtures/workspaces';

function renderListAt(path = '/workspaces') {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces',
    component: WorkspacesListPage,
  });
  const newRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces/new',
    component: () => <div>new workspace page</div>,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces/$workspaceId',
    component: () => <div>workspace detail page</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, newRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...result };
}

describe('WorkspacesListPage', () => {
  it('renders title, CTA, and a card per workspace', async () => {
    renderListAt();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Workspaces' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tạo workspace mới' }),
    ).toHaveAttribute('href', '/workspaces/new');

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-slot="workspace-card"]').length,
      ).toBe(DEMO_WORKSPACES.length);
    });
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });

  it('renders empty state copy when there are no workspaces', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: [] }),
      ),
    );
    renderListAt();
    expect(await screen.findByText('Chưa có workspace nào')).toBeInTheDocument();
  });

  it('renders error state with retry when fetch fails', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    renderListAt();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tải được danh sách workspace.',
    );
    expect(
      screen.getByRole('button', { name: 'Thử lại' }),
    ).toBeInTheDocument();
  });
});
