import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { BindingSplitPane } from '@/components/admin/workspace/binding-split-pane';
import { useAuthStore } from '@/stores/auth-store';
import type { SessionUser } from '@/schemas/auth';

type Item = { id: string; name: string };

function setUser(orgRole: SessionUser['orgRole'] | null) {
  if (orgRole === null) {
    useAuthStore.setState({ user: null });
    return;
  }
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'u@x.com',
      orgId: 'o1',
      orgRole,
      workspaceId: 'w1',
      workspaceRole: 'admin',
    } as SessionUser,
  });
}

const sampleProps = (overrides?: Partial<React.ComponentProps<typeof BindingSplitPane<Item, Item>>>) => ({
  available: [
    { id: 'a1', name: 'Alpha' },
    { id: 'a2', name: 'Beta' },
  ],
  bound: [{ id: 'b1', name: 'Gamma' }],
  getAvailableId: (x: Item) => x.id,
  getAvailableLabel: (x: Item) => x.name,
  getBoundId: (x: Item) => x.id,
  getBoundLabel: (x: Item) => x.name,
  onBind: vi.fn(),
  onUnbind: vi.fn(),
  emptyPoolHeading: 'No items',
  emptyPoolBody: 'Ask your admin.',
  ...overrides,
});

describe('BindingSplitPane', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, accessToken: null, expiresAt: null });
  });

  it('renders both columns with items', () => {
    render(<BindingSplitPane {...sampleProps()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('labels bind/unbind buttons with action + item name', () => {
    render(<BindingSplitPane {...sampleProps()} />);
    expect(
      screen.getByRole('button', { name: 'Bind Alpha' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bind Beta' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Unbind Gamma' }),
    ).toBeInTheDocument();
  });

  it('invokes onBind with the available id', async () => {
    const onBind = vi.fn();
    render(<BindingSplitPane {...sampleProps({ onBind })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bind Alpha' }));
    expect(onBind).toHaveBeenCalledWith('a1');
  });

  it('invokes onUnbind with the bound id', async () => {
    const onUnbind = vi.fn();
    render(<BindingSplitPane {...sampleProps({ onUnbind })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unbind Gamma' }));
    expect(onUnbind).toHaveBeenCalledWith('b1');
  });

  it('renders the trailingSlot per bound item', () => {
    render(
      <BindingSplitPane
        {...sampleProps({
          trailingSlot: (item) => <span>role-of-{item.id}</span>,
        })}
      />,
    );
    expect(screen.getByText('role-of-b1')).toBeInTheDocument();
  });

  it('shows empty-pool state with org-admin CTA when user is org admin', () => {
    setUser('admin');
    render(
      <BindingSplitPane
        {...sampleProps({
          available: [],
          bound: [],
          emptyPoolCtaHref: '/admin/org',
          emptyPoolCtaLabel: 'Open Org Admin',
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No items' })).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Open Org Admin' });
    expect(cta).toHaveAttribute('href', '/admin/org');
  });

  it('hides org-admin CTA when user is not org admin', () => {
    setUser('member');
    render(
      <BindingSplitPane
        {...sampleProps({
          available: [],
          bound: [],
          emptyPoolCtaHref: '/admin/org',
          emptyPoolCtaLabel: 'Open Org Admin',
        })}
      />,
    );
    expect(
      screen.queryByRole('link', { name: 'Open Org Admin' }),
    ).not.toBeInTheDocument();
  });

  it('is axe-clean', async () => {
    const { container } = render(<BindingSplitPane {...sampleProps()} />);
    const r = await axe(container);
    const serious = (r.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});
