import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { routeTree } from '@/router/route-tree';
import type { RouterContext } from '@/router/routes/root-route';

function buildRouter(initialPath: string, context: RouterContext) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context,
  });
}

function renderAt(path: string, context: RouterContext) {
  const router = buildRouter(path, context);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...result };
}

const memberSession = {
  userId: 'u-1',
  workspaceId: 'w-1',
  orgRole: 'member' as const,
  workspaceRole: 'member' as const,
};

describe('AdminForbiddenPage', () => {
  it('renders the access-denied heading on /admin/403', async () => {
    const { findByRole } = renderAt('/admin/403', { session: memberSession });
    const heading = await findByRole('heading', { name: /access denied/i });
    expect(heading).toBeDefined();
  });

  it('has zero serious/critical a11y violations', async () => {
    const { container, findByRole } = renderAt('/admin/403', {
      session: memberSession,
    });
    await findByRole('heading', { name: /access denied/i });

    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });

  it('does not leak org or workspace identifiers in the DOM', async () => {
    const { container, findByRole } = renderAt('/admin/403', {
      session: memberSession,
    });
    await findByRole('heading', { name: /access denied/i });

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/u-1|w-1|member|admin|owner|viewer/);
  });

  it('redirects a non-org-admin away from /admin/org to /admin/403', async () => {
    const { router, findByRole } = renderAt('/admin/org', {
      session: memberSession,
    });
    await findByRole('heading', { name: /access denied/i });
    expect(router.state.location.pathname).toBe('/admin/403');
  });

  it('redirects a viewer away from /admin/workspace to /admin/403', async () => {
    const viewerSession = {
      userId: 'u-2',
      workspaceId: 'w-1',
      orgRole: 'member' as const,
      workspaceRole: 'viewer' as const,
    };
    const { router, findByRole } = renderAt('/admin/workspace', {
      session: viewerSession,
    });
    await findByRole('heading', { name: /access denied/i });
    expect(router.state.location.pathname).toBe('/admin/403');
  });

  it('redirect does not echo the source path in router state', async () => {
    const { router, findByRole } = renderAt('/admin/org', {
      session: memberSession,
    });
    await findByRole('heading', { name: /access denied/i });
    const search = router.state.location.search as Record<string, unknown>;
    expect(search.from).toBeUndefined();
    expect(search.redirect).toBeUndefined();
  });

  it('allows an org admin to reach /admin/org', async () => {
    const adminSession = {
      userId: 'u-3',
      workspaceId: 'w-1',
      orgRole: 'admin' as const,
      workspaceRole: 'admin' as const,
    };
    const { router, findByRole } = renderAt('/admin/org', {
      session: adminSession,
    });
    await findByRole('heading', { name: /organization admin/i });
    expect(router.state.location.pathname).toBe('/admin/org');
  });
});
