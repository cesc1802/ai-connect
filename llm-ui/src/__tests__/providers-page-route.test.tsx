import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ProvidersPage } from '@/pages/providers-page';
import { server } from '@/mocks/server';
import { resetOrgProviderHandlers } from '@/mocks/handlers/admin-org-providers-handlers';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProvidersPage />
    </QueryClientProvider>,
  );
}

describe('ProvidersPage', () => {
  afterEach(() => {
    resetOrgProviderHandlers();
  });

  it('renders Vietnamese page header and provider grid from MSW', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Providers' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Khoá API ở cấp tổ chức')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelectorAll('[data-slot="provider-card"]').length).toBeGreaterThan(
        0,
      );
    });
    expect(screen.getByText('OpenAI primary')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Thêm provider/ }),
    ).toBeInTheDocument();
  });

  it('shows empty state with CTA when no providers exist', async () => {
    server.use(
      http.get('/api/admin/org/providers', () =>
        HttpResponse.json({ providers: [] }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Chưa có provider nào')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Thêm provider' }),
    ).toBeInTheDocument();
  });

  it('shows error state with retry when fetch fails', async () => {
    server.use(
      http.get('/api/admin/org/providers', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tải được providers.',
    );
    expect(
      screen.getByRole('button', { name: 'Thử lại' }),
    ).toBeInTheDocument();
  });
});
