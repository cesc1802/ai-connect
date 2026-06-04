import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { SidebarAccountMenu } from '@/components/sidebar/sidebar-account-menu';
import { server } from '@/mocks/server';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { useThemeStore } from '@/stores/theme-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

const logoutSpy = vi.fn();
vi.mock('@/hooks/use-logout', () => ({
  useLogout: () => ({ mutate: logoutSpy, isPending: false }),
}));

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function renderMenu() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SidebarAccountMenu />
    </QueryClientProvider>,
  );
}

function seed() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
  useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
}

describe('SidebarAccountMenu', () => {
  beforeEach(() => {
    logoutSpy.mockReset();
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
    useThemeStore.getState().setTheme('system');
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });

  it('renders identity line "{role} · {workspaceName}" in workspace context', async () => {
    seed();
    renderMenu();
    expect(
      await screen.findByText(/admin · acme inc\./i),
    ).toBeInTheDocument();
  });

  it('switches identity line to "{orgRole} · Organization" in org context', async () => {
    seed();
    useSidebarUiStore.setState({ context: 'org' });
    renderMenu();
    expect(
      await screen.findByText(/admin · organization/i),
    ).toBeInTheDocument();
  });

  it('Sign out item triggers logout mutation', async () => {
    seed();
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      screen.getByRole('button', { name: /open account menu/i }),
    );
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it('Preferences item opens dialog containing the theme radiogroup', async () => {
    seed();
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      screen.getByRole('button', { name: /open account menu/i }),
    );
    await user.click(screen.getByRole('menuitem', { name: /preferences/i }));
    expect(
      await screen.findByRole('radiogroup', { name: /theme/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /dark/i }));
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('renders nothing when no user is signed in', () => {
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: [] }),
      ),
    );
    const { container } = renderMenu();
    expect(container.firstChild).toBeNull();
  });
});
