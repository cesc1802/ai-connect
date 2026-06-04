import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { EmptyState } from '@/components/admin/empty-state';

describe('EmptyState', () => {
  it('renders heading, body, and optional action', () => {
    render(
      <EmptyState
        heading="Nothing here"
        body="Add your first item to get started."
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('exposes status semantics', () => {
    render(<EmptyState heading="Empty" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('is axe-clean in light and dark', async () => {
    const { container, rerender } = render(
      <EmptyState heading="Empty" body="No data" />,
    );
    let r = await axe(container);
    let serious = (r.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);

    rerender(
      <div className="dark">
        <EmptyState heading="Empty" body="No data" />
      </div>,
    );
    r = await axe(container);
    serious = (r.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});
