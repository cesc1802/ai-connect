import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { useReturnToWorkspace } from '@/hooks/use-workspace-switch';
import { server } from '@/mocks/server';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';
import { DEMO_WORKSPACES } from '@/mocks/fixtures/workspaces';
import type { Workspace } from '@/schemas/workspace';

const navigateSpy = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    );
  return { ...actual, useNavigate: () => navigateSpy };
});

const toastSpy = { message: vi.fn() };
vi.mock('sonner', () => ({
  toast: {
    message: (...args: unknown[]) => toastSpy.message(...args),
    error: vi.fn(),
  },
}));

function wrapper(qc: QueryClient) {
  return function Wrap({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function seed() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
  useSidebarUiStore.setState({ context: 'org', collapsed: false });
}

describe('useReturnToWorkspace', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    toastSpy.message.mockReset();
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  it('restores last-used workspace and navigates to /chat', async () => {
    seed();
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: DEMO_WORKSPACES }),
      ),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReturnToWorkspace(), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => {
      const data = qc.getQueryData<{ workspaces: Workspace[] }>([
        'workspaces',
        'list',
      ]);
      expect(data?.workspaces.length).toBeGreaterThan(0);
    });

    act(() => result.current());

    const state = useActiveWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe('wsp_acme');
    expect(state.activeWorkspaceRole).toBe('admin');
    expect(useSidebarUiStore.getState().context).toBe('workspace');
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/chat' });
  });

  it('clears stale id and routes to picker when last-used id is revoked', async () => {
    seed();
    useActiveWorkspaceStore
      .getState()
      .setActiveWorkspace('wsp_gone', 'member');
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: DEMO_WORKSPACES }),
      ),
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useReturnToWorkspace(), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => {
      expect(
        qc.getQueryData(['workspaces', 'list']),
      ).toBeDefined();
    });

    act(() => result.current());

    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBeNull();
    expect(toastSpy.message).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/workspaces/pick' });
  });
});
