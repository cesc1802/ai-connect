import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';

import { DataTable, type DataTableColumn } from '@/components/admin/data-table';

interface Row {
  id: string;
  name: string;
  role: string;
}

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', cell: (r) => r.name },
  { key: 'role', header: 'Role', cell: (r) => r.role },
];

const ROWS: Row[] = [
  { id: '1', name: 'Ada Lovelace', role: 'admin' },
  { id: '2', name: 'Alan Turing', role: 'member' },
];

async function expectNoSeriousAxe(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

describe('DataTable — ready state', () => {
  it('renders a table with caption, headers and rows', () => {
    render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
  });

  it('is axe-clean in light and dark', async () => {
    const { container, rerender } = render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
      />,
    );
    await expectNoSeriousAxe(container);
    rerender(
      <div className="dark">
        <DataTable
          caption="Test rows"
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
        />
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});

describe('DataTable — loading state', () => {
  it('renders an aria-busy skeleton', () => {
    render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        state="loading"
      />,
    );
    const status = screen.getByRole('status', { name: 'Loading rows' });
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('is axe-clean in light and dark', async () => {
    const { container, rerender } = render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        state="loading"
      />,
    );
    await expectNoSeriousAxe(container);
    rerender(
      <div className="dark">
        <DataTable
          caption="Test rows"
          columns={COLUMNS}
          rows={[]}
          rowKey={(r) => r.id}
          state="loading"
        />
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});

describe('DataTable — empty state', () => {
  it('renders an EmptyState when rows are empty', () => {
    render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        emptyHeading="No members yet"
      />,
    );
    expect(screen.getByText('No members yet')).toBeInTheDocument();
  });

  it('is axe-clean in light and dark', async () => {
    const { container, rerender } = render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        emptyHeading="No members yet"
      />,
    );
    await expectNoSeriousAxe(container);
    rerender(
      <div className="dark">
        <DataTable
          caption="Test rows"
          columns={COLUMNS}
          rows={[]}
          rowKey={(r) => r.id}
          emptyHeading="No members yet"
        />
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});

describe('DataTable — error state', () => {
  it('renders an alert and a retry button that fires the callback', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        state="error"
        errorMessage="Could not load"
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('is axe-clean in light and dark', async () => {
    const { container, rerender } = render(
      <DataTable
        caption="Test rows"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        state="error"
        errorMessage="Could not load"
        onRetry={() => {}}
      />,
    );
    await expectNoSeriousAxe(container);
    rerender(
      <div className="dark">
        <DataTable
          caption="Test rows"
          columns={COLUMNS}
          rows={[]}
          rowKey={(r) => r.id}
          state="error"
          errorMessage="Could not load"
          onRetry={() => {}}
        />
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});
