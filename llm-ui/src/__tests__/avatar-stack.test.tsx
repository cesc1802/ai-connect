import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AvatarStack } from '@/components/rbac/avatar-stack';

const USERS = [
  { id: '1', label: 'Alice Nguyen' },
  { id: '2', label: 'Bob Tran' },
  { id: '3', label: 'Chau Le' },
  { id: '4', label: 'Dao Vu' },
  { id: '5', label: 'Em Pham' },
  { id: '6', label: 'Fa Hoang' },
];

describe('AvatarStack', () => {
  it('renders all avatars when count ≤ max', () => {
    render(<AvatarStack users={USERS.slice(0, 3)} max={4} />);
    const list = screen.getByRole('list');
    expect(list.querySelectorAll('[role="listitem"]').length).toBe(3);
    expect(screen.getByLabelText('Alice Nguyen')).toBeInTheDocument();
  });

  it('caps at max and shows +N overflow chip', () => {
    render(<AvatarStack users={USERS} max={4} />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(5);
    expect(screen.getByLabelText('2 more')).toHaveTextContent('+2');
  });

  it('renders initials from the label', () => {
    render(<AvatarStack users={[{ id: '1', label: 'Alice Nguyen' }]} />);
    expect(screen.getByText('AN')).toBeInTheDocument();
  });

  it('handles empty user list with an accessible label', () => {
    render(<AvatarStack users={[]} ariaLabel="No members" />);
    const list = screen.getByRole('list', { name: 'No members' });
    expect(list.querySelectorAll('[role="listitem"]').length).toBe(0);
  });
});
