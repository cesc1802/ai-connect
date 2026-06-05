import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
} from '@tanstack/react-router';

import { WorkspaceCard } from '@/components/rbac/workspaces/workspace-card';
import type { Workspace } from '@/schemas/workspace';

const workspace: Workspace = {
  id: 'wsp_acme',
  name: 'Acme Inc.',
  slug: 'acme-inc',
  role: 'admin',
};

function renderCard() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const cardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <WorkspaceCard workspace={workspace} />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces/$workspaceId',
    component: () => <div>detail</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([cardRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('WorkspaceCard', () => {
  it('renders workspace name, slug, role badge, and Mở action', async () => {
    renderCard();
    expect(await screen.findByText('Acme Inc.')).toBeInTheDocument();
    expect(screen.getByText('acme-inc')).toBeInTheDocument();
    const badge = document.querySelector('[data-slot="role-badge"]');
    expect(badge?.getAttribute('data-role')).toBe('admin');
    expect(screen.getByRole('link', { name: 'Mở' })).toHaveAttribute(
      'href',
      '/workspaces/wsp_acme',
    );
  });
});
