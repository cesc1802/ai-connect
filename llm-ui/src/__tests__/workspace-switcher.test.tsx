import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { WorkspaceSwitcher } from '@/components/sidebar/workspace-switcher';
import { server } from '@/mocks/server';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useStreamingStore } from '@/stores/streaming-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_MEMBER_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';
import { DEMO_WORKSPACES } from '@/mocks/fixtures/workspaces';

const navigateSpy = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return { ...actual, useNavigate: () => navigateSpy };
});

const toastSpy = { error: vi.fn(), message: vi.fn() };
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastSpy.error(...args),
    message: (...args: unknown[]) => toastSpy.message(...args),
  },
}));

function renderSwitcher() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <WorkspaceSwitcher />
      </QueryClientProvider>,
    ),
  };
}

function seedAdminSession() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useActiveWorkspaceStore
    .getState()
    .setActiveWorkspace('wsp_personal', 'owner');
}

function seedMemberSession() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_MEMBER_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useActiveWorkspaceStore
    .getState()
    .setActiveWorkspace('wsp_research', 'member');
}

function mockWorkspaces(list = DEMO_WORKSPACES) {
  server.use(
    http.get('/api/workspaces', () => HttpResponse.json({ workspaces: list })),
  );
}

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    toastSpy.error.mockReset();
    toastSpy.message.mockReset();
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useStreamingStore.getState().clear();
  });

  it('renders the active workspace name on the trigger', async () => {
    seedAdminSession();
    mockWorkspaces();
    renderSwitcher();
    expect(await screen.findByText('Personal')).toBeInTheDocument();
  });

  it('switches active workspace: sets id+role, resets caches, navigates to /chat', async () => {
    seedAdminSession();
    mockWorkspaces();
    const user = userEvent.setup();
    const { qc } = renderSwitcher();

    qc.setQueryData(['conversations', 'list', 'wsp_personal'], { conversations: [] });
    useStreamingStore.getState().start('msg_x', 'cv_x');

    await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
    await user.click(await screen.findByRole('menuitem', { name: /acme inc\./i }));

    const state = useActiveWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe('wsp_acme');
    expect(state.activeWorkspaceRole).toBe('admin');
    expect(qc.getQueryData(['conversations', 'list', 'wsp_personal'])).toBeUndefined();
    expect(useStreamingStore.getState().entries).toEqual({});
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
    expect(useSidebarUiStore.getState().context).toBe('workspace');
  });

  it('marks the active item with aria-current', async () => {
    seedAdminSession();
    mockWorkspaces();
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
    const active = await screen.findByRole('menuitem', { name: /personal/i });
    expect(active).toHaveAttribute('aria-current', 'true');
  });

  it('shows admin-only New Workspace and Org Settings entries to org admins', async () => {
    seedAdminSession();
    mockWorkspaces();
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
    expect(
      await screen.findByRole('menuitem', { name: /new workspace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /org settings/i }),
    ).toBeInTheDocument();
  });

  it('hides admin-only entries for org members', async () => {
    seedMemberSession();
    mockWorkspaces();
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
    expect(
      screen.queryByRole('menuitem', { name: /new workspace/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: /org settings/i }),
    ).toBeNull();
  });

  it('Org Settings menu item flips sidebar context to org', async () => {
    seedAdminSession();
    mockWorkspaces();
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
    await user.click(
      await screen.findByRole('menuitem', { name: /org settings/i }),
    );
    expect(useSidebarUiStore.getState().context).toBe('org');
  });

  it('groups workspaces under their org label', async () => {
    seedAdminSession();
    mockWorkspaces();
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(await screen.findByRole('button', { name: /switch workspace/i }));
    const label = await screen.findByText(/demo org/i);
    const group = label.closest('[role="group"]');
    expect(group).not.toBeNull();
    expect(
      within(group as HTMLElement).getByRole('menuitem', { name: /personal/i }),
    ).toBeInTheDocument();
  });
});
