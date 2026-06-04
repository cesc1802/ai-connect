import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from '@/router/route-tree';
import type { RouterContext } from '@/router/routes/root-route';

function buildRouter(initialPath: string, context: RouterContext) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context,
  });
}

function renderWithProviders(router: ReturnType<typeof buildRouter>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('router redirect guard', () => {
  it('builds the route tree without errors', () => {
    const router = buildRouter('/login', { session: null });
    expect(router).toBeDefined();
  });

  it('redirects /chat to /login when session is null', async () => {
    const router = buildRouter('/chat', { session: null });
    renderWithProviders(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(screen.getByText(/sign in to llm-ui/i)).toBeInTheDocument();
  });

  it('allows /chat when session is present', async () => {
    const router = buildRouter('/chat', {
      session: { userId: 'u-1', workspaceId: 'w-1' },
    });
    renderWithProviders(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/chat');
    });
  });

  it('renders the not-found view for unknown routes', async () => {
    const router = buildRouter('/random/garbage', { session: null });
    renderWithProviders(router);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /page not found/i })).toBeDefined();
    });
  });
});
