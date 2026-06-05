import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';

import { WorkspaceDetailPage } from '@/pages/workspace-detail-page';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';

function renderDetailAt(workspaceId: string) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces',
    component: () => <div>list</div>,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces/$workspaceId',
    component: WorkspaceDetailPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute]),
    history: createMemoryHistory({
      initialEntries: [`/workspaces/${workspaceId}`],
    }),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('WorkspaceDetailPage', () => {
  beforeEach(() => {
    useActiveWorkspaceStore.getState().clear();
  });

  it('renders workspace name, RoleBadge, back link, and Vietnamese tab labels', async () => {
    renderDetailAt('wsp_acme');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Acme Inc.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute(
      'href',
      '/workspaces',
    );
    const badge = document.querySelector('[data-slot="role-badge"]');
    expect(badge?.getAttribute('data-role')).toBe('admin');

    // tab labels rendered (desktop tablist OR mobile select)
    const tablist = screen.queryByRole('tablist');
    if (tablist) {
      expect(
        screen.getByRole('tab', { name: 'Thành viên' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Templates' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Providers' })).toBeInTheDocument();
    } else {
      const select = document.querySelector(
        '[data-slot="admin-tabs-select"]',
      );
      expect(select?.textContent).toMatch(/Thành viên/);
    }
  });

  it('sets the active workspace store on mount', async () => {
    renderDetailAt('wsp_acme');
    await screen.findByRole('heading', { level: 1, name: 'Acme Inc.' });
    await waitFor(() => {
      const s = useActiveWorkspaceStore.getState();
      expect(s.activeWorkspaceId).toBe('wsp_acme');
      expect(s.activeWorkspaceRole).toBe('admin');
    });
  });

  it('renders not-found UI for an unknown workspace id', async () => {
    renderDetailAt('wsp_unknown');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Workspace không tồn tại',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quay lại' }),
    ).toBeInTheDocument();
  });
});
