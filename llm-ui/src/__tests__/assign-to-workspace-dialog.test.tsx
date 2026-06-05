import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssignToWorkspaceDialog } from '@/components/rbac/assignment/assign-to-workspace-dialog';
import type { Workspace } from '@/schemas/workspace';

const WORKSPACES: Workspace[] = [
  { id: 'ws-1', name: 'E-Commerce', slug: 'ecom', role: 'admin' },
  { id: 'ws-2', name: 'Banking', slug: 'bank', role: 'member' },
];

describe('AssignToWorkspaceDialog', () => {
  it('renders Vietnamese title, description, and submit label', () => {
    render(
      <AssignToWorkspaceDialog
        open
        onOpenChange={() => undefined}
        userLabel="ada@demo.example"
        availableWorkspaces={WORKSPACES}
        onSubmit={() => undefined}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Gán ada@demo.example vào workspace',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chọn workspace và vai trò.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Gán quyền/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('lists only available workspaces and submits with chosen workspace and default role', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AssignToWorkspaceDialog
        open
        onOpenChange={() => undefined}
        userLabel="ada@demo.example"
        availableWorkspaces={WORKSPACES}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('E-Commerce')).toBeInTheDocument();
    expect(screen.getByText('Banking')).toBeInTheDocument();

    const second = screen.getByRole('radio', { name: /Banking/ });
    await userEvent.click(second);
    expect(second).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('button', { name: /Gán quyền/ }));

    expect(onSubmit).toHaveBeenCalledWith('ws-2', 'member');
  });

  it('shows empty state and disables submit when no workspaces are available', () => {
    render(
      <AssignToWorkspaceDialog
        open
        onOpenChange={() => undefined}
        userLabel="ada@demo.example"
        availableWorkspaces={[]}
        onSubmit={() => undefined}
      />,
    );

    expect(
      screen.getByText('ada@demo.example đã có mặt trong tất cả workspace.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gán quyền/ })).toBeDisabled();
  });
});
