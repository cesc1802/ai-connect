import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsersIcon } from 'lucide-react';

import { StatCard } from '@/components/rbac/stat-card';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Active users" value="128" />);
    expect(screen.getByText('Active users')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders icon tile when icon is provided', () => {
    const { container } = render(
      <StatCard label="Active users" value="128" icon={UsersIcon} />,
    );
    expect(
      container.querySelector('[data-slot="stat-card-icon"]'),
    ).not.toBeNull();
  });

  it('applies the trend class to the delta', () => {
    const { container, rerender } = render(
      <StatCard
        label="Members"
        value={42}
        delta={{ value: '+5', trend: 'up' }}
      />,
    );
    let delta = container.querySelector('[data-slot="stat-card-delta"]')!;
    expect(delta.getAttribute('data-trend')).toBe('up');
    expect(delta.className).toContain('text-success');

    rerender(
      <StatCard
        label="Members"
        value={42}
        delta={{ value: '-3', trend: 'down' }}
      />,
    );
    delta = container.querySelector('[data-slot="stat-card-delta"]')!;
    expect(delta.getAttribute('data-trend')).toBe('down');
    expect(delta.className).toContain('text-destructive');
  });
});
