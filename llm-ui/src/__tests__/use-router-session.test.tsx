import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouterSession } from '@/hooks/use-router-session';
import { useAuthStore } from '@/stores/auth-store';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_EXPIRES_IN_SEC,
  DEMO_USER,
} from '@/mocks/fixtures/users';

describe('useRouterSession', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    useActiveWorkspaceStore.getState().clear();
  });

  it('returns null when not authenticated', () => {
    const { result } = renderHook(() => useRouterSession());
    expect(result.current).toBeNull();
  });

  it('falls back to user role when active-workspace store is empty', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    const { result } = renderHook(() => useRouterSession());
    expect(result.current).not.toBeNull();
    expect(result.current?.workspaceId).toBe(DEMO_USER.workspaceId);
    expect(result.current?.workspaceRole).toBe(DEMO_USER.workspaceRole);
    expect(result.current?.orgRole).toBe(DEMO_USER.orgRole);
  });

  it('prefers the active-workspace store role over the static user role', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    useActiveWorkspaceStore
      .getState()
      .setActiveWorkspace('wsp_acme', 'member');
    const { result } = renderHook(() => useRouterSession());
    expect(result.current?.workspaceId).toBe('wsp_acme');
    expect(result.current?.workspaceRole).toBe('member');
  });

  it('re-renders when the active-workspace store changes', () => {
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
    const { result } = renderHook(() => useRouterSession());
    expect(result.current?.workspaceRole).toBe(DEMO_USER.workspaceRole);

    act(() => {
      useActiveWorkspaceStore
        .getState()
        .setActiveWorkspace('wsp_research', 'viewer');
    });
    expect(result.current?.workspaceId).toBe('wsp_research');
    expect(result.current?.workspaceRole).toBe('viewer');
  });
});
