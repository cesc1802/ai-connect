import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { useLandingDecision } from '@/hooks/use-landing-decision';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

const navigateSpy = vi.fn();
vi.mock('@/router', () => ({
  router: { navigate: (args: unknown) => navigateSpy(args) },
}));

function seedAuth() {
  useAuthStore.getState().setSession({
    accessToken: DEMO_ACCESS_TOKEN,
    user: DEMO_USER,
    expiresInSec: DEMO_EXPIRES_IN_SEC,
  });
}

describe('useLandingDecision', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
    useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });

  it('without auth, resolves to ready immediately and does not navigate', async () => {
    const { result } = renderHook(() => useLandingDecision(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('valid last-used workspace restores role and stays on current route', async () => {
    seedAuth();
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'member');
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({
          workspaces: [
            {
              id: 'wsp_acme',
              name: 'Acme',
              slug: 'acme',
              role: 'admin',
              orgId: 'org-demo',
              orgName: 'Demo',
            },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => useLandingDecision(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe('wsp_acme');
    expect(useActiveWorkspaceStore.getState().activeWorkspaceRole).toBe('admin');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('invalid last-used workspace clears store and redirects to picker', async () => {
    seedAuth();
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_stale', 'admin');
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({
          workspaces: [
            {
              id: 'wsp_other',
              name: 'Other',
              slug: 'other',
              role: 'member',
            },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => useLandingDecision(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/workspaces/pick',
      replace: true,
    });
  });

  it('no memberships redirects to /no-workspace', async () => {
    seedAuth();
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({ workspaces: [] }),
      ),
    );
    const { result } = renderHook(() => useLandingDecision(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/no-workspace',
      replace: true,
    });
  });

  it('no last-used redirects to the picker', async () => {
    seedAuth();
    server.use(
      http.get('/api/workspaces', () =>
        HttpResponse.json({
          workspaces: [
            { id: 'wsp_a', name: 'A', slug: 'a', role: 'admin' },
            { id: 'wsp_b', name: 'B', slug: 'b', role: 'member' },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => useLandingDecision(true));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/workspaces/pick',
      replace: true,
    });
  });

  it('does not run while authReady is false', () => {
    seedAuth();
    const { result } = renderHook(() => useLandingDecision(false));
    expect(result.current.status).toBe('pending');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
