import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AssignmentPage } from '@/pages/assignment-page';
import { resetOrgUserHandlers } from '@/mocks/handlers/admin-users';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Wrapper({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('AssignmentPage', () => {
  beforeEach(() => {
    resetOrgUserHandlers();
  });
  afterEach(() => {
    resetOrgUserHandlers();
  });

  it('renders Vietnamese page header verbatim from the mockup', () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AssignmentPage />
      </Wrapper>,
    );

    expect(
      screen.getByRole('heading', { name: 'Phân quyền người dùng' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Org Owner gán thành viên vào workspace và đặt vai trò cho từng người.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the member rail with search input and selectable rows', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AssignmentPage />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Tìm thành viên')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('ada@demo.example').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('grace@demo.example').length).toBeGreaterThan(0);
  });

  it('filters the rail by the search input', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AssignmentPage />
      </Wrapper>,
    );

    await waitFor(() => {
      const rail = screen.getByRole('listbox');
      expect(rail.querySelectorAll('[role="option"]').length).toBeGreaterThan(
        1,
      );
    });

    await userEvent.type(screen.getByLabelText('Tìm thành viên'), 'ada');

    await waitFor(() => {
      const rail = screen.getByRole('listbox');
      const options = Array.from(
        rail.querySelectorAll('[role="option"]'),
      ) as HTMLElement[];
      expect(options.length).toBe(1);
      expect(options[0]!.textContent).toContain('ada@demo.example');
    });
  });

  it('opens the assign dialog when clicking the CTA', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AssignmentPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('ada@demo.example').length).toBeGreaterThan(0);
    });

    const ctas = screen.getAllByRole('button', { name: /Gán vào workspace/ });
    await userEvent.click(ctas[0]!);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Gán ada@demo.example vào workspace/,
        }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Chọn workspace và vai trò.')).toBeInTheDocument();
  });
});
