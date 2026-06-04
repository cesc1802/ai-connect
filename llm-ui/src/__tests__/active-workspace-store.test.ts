import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';

describe('active-workspace-store', () => {
  beforeEach(() => {
    useActiveWorkspaceStore.getState().clear();
  });
  afterEach(() => {
    useActiveWorkspaceStore.getState().clear();
  });

  it('starts empty', () => {
    const s = useActiveWorkspaceStore.getState();
    expect(s.activeWorkspaceId).toBeNull();
    expect(s.activeWorkspaceRole).toBeNull();
  });

  it('setActiveWorkspace stores both id and role', () => {
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'admin');
    const s = useActiveWorkspaceStore.getState();
    expect(s.activeWorkspaceId).toBe('wsp_acme');
    expect(s.activeWorkspaceRole).toBe('admin');
  });

  it('clear resets id and role', () => {
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'owner');
    useActiveWorkspaceStore.getState().clear();
    const s = useActiveWorkspaceStore.getState();
    expect(s.activeWorkspaceId).toBeNull();
    expect(s.activeWorkspaceRole).toBeNull();
  });

  it('persists both id and role to localStorage', () => {
    useActiveWorkspaceStore.getState().setActiveWorkspace('wsp_acme', 'member');
    const raw = localStorage.getItem('active-workspace');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state: { activeWorkspaceId: string | null; activeWorkspaceRole: string | null };
    };
    expect(parsed.state.activeWorkspaceId).toBe('wsp_acme');
    expect(parsed.state.activeWorkspaceRole).toBe('member');
  });
});
