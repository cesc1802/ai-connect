import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { AdminConsoleShell } from '@/components/admin/admin-console-shell';

describe('AdminConsoleShell', () => {
  it('renders the title as the labelled-by heading', () => {
    render(
      <AdminConsoleShell title="Organization Admin">
        <p>body</p>
      </AdminConsoleShell>,
    );
    const heading = screen.getByRole('heading', {
      name: 'Organization Admin',
      level: 1,
    });
    expect(heading).toBeInTheDocument();
    const region = heading.closest('section');
    expect(region).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('renders an optional description', () => {
    render(
      <AdminConsoleShell title="Workspace Admin" description="Manage things">
        <p>body</p>
      </AdminConsoleShell>,
    );
    expect(screen.getByText('Manage things')).toBeInTheDocument();
  });

  it('has zero serious/critical a11y violations in light theme', async () => {
    const { container } = render(
      <AdminConsoleShell title="Organization Admin">
        <p>body</p>
      </AdminConsoleShell>,
    );
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });

  it('has zero serious/critical a11y violations in dark theme', async () => {
    const { container } = render(
      <div className="dark">
        <AdminConsoleShell title="Organization Admin">
          <p>body</p>
        </AdminConsoleShell>
      </div>,
    );
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});
