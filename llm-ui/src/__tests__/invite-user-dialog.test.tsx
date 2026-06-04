import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InviteUserDialog } from '@/components/admin/org/invite-user-dialog';
import { ApiError } from '@/api/errors';

describe('InviteUserDialog', () => {
  it('calls onInvite with the typed email and closes on success', async () => {
    const user = userEvent.setup();
    const onInvite = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <InviteUserDialog
        open
        onOpenChange={onOpenChange}
        onInvite={onInvite}
      />,
    );
    await user.type(screen.getByLabelText('Email'), 'new@demo.example');
    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith({ email: 'new@demo.example' }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('keeps the dialog open and shows an inline field error on 409', async () => {
    const user = userEvent.setup();
    const onInvite = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'HTTP 409'));
    const onOpenChange = vi.fn();
    render(
      <InviteUserDialog
        open
        onOpenChange={onOpenChange}
        onInvite={onInvite}
      />,
    );
    await user.type(screen.getByLabelText('Email'), 'dupe@example.com');
    await user.click(screen.getByRole('button', { name: 'Invite user' }));

    await waitFor(() => {
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
    expect(
      screen.getByText('A pending invite already exists for this email'),
    ).toBeInTheDocument();
    // dialog must NOT close on duplicate
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('rejects an invalid email without calling onInvite', async () => {
    const user = userEvent.setup();
    const onInvite = vi.fn();
    render(
      <InviteUserDialog
        open
        onOpenChange={() => {}}
        onInvite={onInvite}
      />,
    );
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    await waitFor(() => {
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
    expect(onInvite).not.toHaveBeenCalled();
  });
});
