import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';

function resetStore() {
  useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  localStorage.removeItem('sidebar-ui');
}

describe('sidebar-ui-store', () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it('defaults to workspace context and uncollapsed', () => {
    const s = useSidebarUiStore.getState();
    expect(s.context).toBe('workspace');
    expect(s.collapsed).toBe(false);
  });

  it('setContext switches between workspace and org', () => {
    useSidebarUiStore.getState().setContext('org');
    expect(useSidebarUiStore.getState().context).toBe('org');
    useSidebarUiStore.getState().setContext('workspace');
    expect(useSidebarUiStore.getState().context).toBe('workspace');
  });

  it('toggleCollapsed flips collapsed', () => {
    useSidebarUiStore.getState().toggleCollapsed();
    expect(useSidebarUiStore.getState().collapsed).toBe(true);
    useSidebarUiStore.getState().toggleCollapsed();
    expect(useSidebarUiStore.getState().collapsed).toBe(false);
  });

  it('persists only collapsed (not context)', () => {
    useSidebarUiStore.getState().setContext('org');
    useSidebarUiStore.getState().setCollapsed(true);
    const raw = localStorage.getItem('sidebar-ui');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state: { collapsed: boolean; context?: string };
    };
    expect(parsed.state.collapsed).toBe(true);
    expect(parsed.state.context).toBeUndefined();
  });
});
