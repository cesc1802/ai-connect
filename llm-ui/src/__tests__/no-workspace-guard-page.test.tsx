import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoWorkspaceGuardPage } from '@/pages/no-workspace-guard-page';

const logoutSpy = vi.fn();
vi.mock('@/hooks/use-logout', () => ({
  useLogout: () => ({ mutate: logoutSpy, isPending: false }),
}));

describe('NoWorkspaceGuardPage', () => {
  it('shows the not-a-member message and a Sign out action', async () => {
    const user = userEvent.setup();
    render(<NoWorkspaceGuardPage />);
    expect(screen.getByText(/no workspace available/i)).toBeInTheDocument();
    expect(
      screen.getByText(/contact your organization admin/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });
});
