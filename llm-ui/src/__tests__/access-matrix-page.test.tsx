import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AccessMatrixPage } from '@/pages/access-matrix-page';
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

describe('AccessMatrixPage', () => {
  beforeEach(() => {
    resetOrgUserHandlers();
  });
  afterEach(() => {
    resetOrgUserHandlers();
  });

  it('renders Vietnamese heading, description, and legend', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AccessMatrixPage />
      </Wrapper>,
    );

    expect(
      screen.getByRole('heading', { name: 'Ma trận phân quyền' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Một dòng cho mỗi người, một cột cho mỗi workspace. Thấy ngay ai giữ vai trò gì, ở đâu.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Chú thích vai trò')).toBeInTheDocument();
  });

  it('filters the user rows by the search input', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <AccessMatrixPage />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('ada@demo.example')).toBeInTheDocument();
    });
    expect(screen.getByText('grace@demo.example')).toBeInTheDocument();

    const input = screen.getByLabelText('Tìm thành viên theo email');
    await userEvent.type(input, 'ada');

    await waitFor(() => {
      expect(screen.queryByText('grace@demo.example')).not.toBeInTheDocument();
    });
    expect(screen.getByText('ada@demo.example')).toBeInTheDocument();
  });
});
