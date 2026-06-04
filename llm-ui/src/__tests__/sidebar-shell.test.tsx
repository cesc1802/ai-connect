import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarShell } from '@/components/sidebar/sidebar-shell';
import { SidebarSection } from '@/components/sidebar/sidebar-section';
import { useSidebarUiStore } from '@/stores/sidebar-ui-store';

function resetStore() {
  useSidebarUiStore.setState({ context: 'workspace', collapsed: false });
  localStorage.removeItem('sidebar-ui');
}

describe('SidebarShell', () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it('renders header, sections, and account slots', () => {
    render(
      <SidebarShell
        header={<div>HEADER</div>}
        account={<div>ACCOUNT</div>}
      >
        <SidebarSection title="Chat">item-a</SidebarSection>
      </SidebarShell>,
    );
    expect(screen.getByText('HEADER')).toBeInTheDocument();
    expect(screen.getByText('ACCOUNT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByText('item-a')).toBeInTheDocument();
  });

  it('collapse toggle flips store and persists', async () => {
    const user = userEvent.setup();
    render(
      <SidebarShell>
        <SidebarSection title="Chat">item-a</SidebarSection>
      </SidebarShell>,
    );

    const toggle = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(useSidebarUiStore.getState().collapsed).toBe(true);
    expect(
      screen.getByRole('button', { name: /expand sidebar/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    const raw = localStorage.getItem('sidebar-ui');
    expect(raw && JSON.parse(raw).state.collapsed).toBe(true);
  });

  it('rail mode hides section heading and shows popover trigger labeled by title', async () => {
    useSidebarUiStore.setState({ collapsed: true });
    render(
      <SidebarShell>
        <SidebarSection title="Chat">item-a</SidebarSection>
      </SidebarShell>,
    );

    expect(screen.queryByRole('heading', { name: /chat/i })).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Chat' });
    expect(trigger).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(trigger);
    // Popover content portals into body
    expect(await screen.findByText('item-a')).toBeInTheDocument();
  });

  it('re-renders when sidebar-ui-store changes externally', () => {
    render(
      <SidebarShell>
        <SidebarSection title="Chat">item-a</SidebarSection>
      </SidebarShell>,
    );
    expect(screen.getByRole('heading', { name: /chat/i })).toBeInTheDocument();
    act(() => {
      useSidebarUiStore.getState().setCollapsed(true);
    });
    expect(screen.queryByRole('heading', { name: /chat/i })).toBeNull();
  });
});
