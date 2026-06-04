import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { WorkspacePickPage } from '@/pages/workspace-pick-page';
import { server } from '@/mocks/server';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { DEMO_ACCESS_TOKEN, DEMO_USER, DEMO_EXPIRES_IN_SEC } from '@/mocks/fixtures/users';

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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspacePickPage />
    </QueryClientProvider>,
  );
}

describe('WorkspacePickPage', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    useActiveWorkspaceStore.getState().setWorkspace(null);
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().setWorkspace(null);
  });

  it('auto-selects and redirects to /chat when there is a single workspace', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({
          workspaces: [{ id: 'wsp_only', name: 'Solo', slug: 'solo', role: 'owner' }],
        }),
      ),
    );
    renderPage();

    await vi.waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
    });
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe('wsp_only');
  });

  it('renders one card per workspace when there are multiple', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({
          workspaces: [
            { id: 'wsp_a', name: 'Alpha', slug: 'alpha', role: 'owner' },
            { id: 'wsp_b', name: 'Beta', slug: 'beta', role: 'admin' },
          ],
        }),
      ),
    );
    renderPage();

    expect(await screen.findByRole('button', { name: /open alpha workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open beta workspace/i })).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('selecting a card navigates to /chat and stores the workspace id', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({
          workspaces: [
            { id: 'wsp_a', name: 'Alpha', slug: 'alpha', role: 'owner' },
            { id: 'wsp_b', name: 'Beta', slug: 'beta', role: 'admin' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: /open beta workspace/i }),
    );

    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe('wsp_b');
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
  });

  it('renders an error state with retry when the workspace fetch fails', async () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ error: 'BOOM' }, { status: 500 }),
      ),
    );
    renderPage();

    expect(
      await screen.findByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
