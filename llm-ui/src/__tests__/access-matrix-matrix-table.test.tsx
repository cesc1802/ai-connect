import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { MatrixTable } from '@/components/rbac/matrix/matrix-table';
import type { OrgUserRow } from '@/schemas/admin';
import type { Workspace, WorkspaceRole } from '@/schemas/workspace';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

const USERS: OrgUserRow[] = [
  {
    id: 'u-1',
    email: 'ada@demo.example',
    status: 'active',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u-2',
    email: 'grace@demo.example',
    status: 'active',
    joinedAt: '2026-01-02T00:00:00.000Z',
  },
];

const WORKSPACES: Workspace[] = [
  { id: 'ws-1', name: 'E-Commerce', slug: 'ecom', role: 'admin' },
  { id: 'ws-2', name: 'Banking', slug: 'bank', role: 'member' },
];

describe('MatrixTable', () => {
  it('renders header for each workspace and row per user', () => {
    const getRole = (uid: string, wsid: string): WorkspaceRole | null => {
      if (uid === 'u-1' && wsid === 'ws-1') return 'admin';
      if (uid === 'u-2' && wsid === 'ws-2') return 'viewer';
      return null;
    };
    render(
      <MatrixTable users={USERS} workspaces={WORKSPACES} getRole={getRole} />,
    );

    expect(screen.getByText('Thành viên')).toBeInTheDocument();
    expect(screen.getByText('E-Commerce')).toBeInTheDocument();
    expect(screen.getByText('Banking')).toBeInTheDocument();

    expect(screen.getByText('ada@demo.example')).toBeInTheDocument();
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('renders em-dash with aria-label for empty cells', () => {
    const getRole = (): WorkspaceRole | null => null;
    render(
      <MatrixTable users={USERS} workspaces={WORKSPACES} getRole={getRole} />,
    );
    const empties = screen.getAllByLabelText('Chưa tham gia');
    expect(empties).toHaveLength(USERS.length * WORKSPACES.length);
    for (const node of empties) {
      expect(node.textContent).toBe('—');
    }
  });

  it('applies sticky positioning to the corner, row-header, and column header', () => {
    const getRole = (): WorkspaceRole | null => 'member';
    const { container } = render(
      <MatrixTable users={USERS} workspaces={WORKSPACES} getRole={getRole} />,
    );
    const corner = container.querySelector('[data-slot="matrix-corner"]');
    expect(corner?.className).toContain('sticky');
    expect(corner?.className).toContain('left-0');

    const rowHead = container.querySelector('[data-slot="matrix-row-head"]');
    expect(rowHead?.className).toContain('sticky');
    expect(rowHead?.className).toContain('left-0');

    const colHead = container.querySelector('[data-slot="matrix-col-head"]');
    expect(colHead?.className).toContain('sticky');
    expect(colHead?.className).toContain('top-0');
  });

  it('renders an anchor for non-empty cells pointing to assignment', () => {
    const getRole = (uid: string): WorkspaceRole | null =>
      uid === 'u-1' ? 'admin' : null;
    const { container } = render(
      <MatrixTable users={USERS} workspaces={WORKSPACES} getRole={getRole} />,
    );
    const cell = container.querySelector(
      '[data-slot="matrix-cell"][data-user-id="u-1"][data-workspace-id="ws-1"]',
    ) as HTMLAnchorElement | null;
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute('href')).toContain('/admin/org/assignment');
    expect(cell?.getAttribute('href')).toContain('user=u-1');
    expect(cell?.getAttribute('href')).toContain('workspace=ws-1');
    expect(within(cell as HTMLElement).getByText('Admin')).toBeInTheDocument();
  });
});
