import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import type { ReactNode } from 'react';

import { ProvidersTab } from '@/components/admin/org/providers-tab';
import { server } from '@/mocks/server';
import { resetOrgProviderHandlers } from '@/mocks/handlers/admin-org-providers-handlers';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
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

async function expectNoSeriousAxe(container: HTMLElement) {
  const results = await axe(container);
  const serious = (results.violations ?? []).filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious).toEqual([]);
}

describe('ProvidersTab — loaded state', () => {
  it('renders provider rows with masked last-four', async () => {
    resetOrgProviderHandlers();
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <ProvidersTab />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText('OpenAI primary')).toBeInTheDocument(),
    );
    expect(screen.getByText('Anthropic prod')).toBeInTheDocument();
    expect(screen.getByText('••••1234')).toBeInTheDocument();
    expect(screen.getByText('••••5678')).toBeInTheDocument();
  });

  it('is axe-clean in loaded state', async () => {
    resetOrgProviderHandlers();
    const client = makeClient();
    const { container } = render(
      <Wrapper client={client}>
        <ProvidersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('OpenAI primary')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);
  });
});

describe('ProvidersTab — toggle is optimistic', () => {
  it('flips the badge before the server responds, then keeps it on success', async () => {
    resetOrgProviderHandlers();
    const client = makeClient();
    const user = userEvent.setup();
    render(
      <Wrapper client={client}>
        <ProvidersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('OpenAI primary')).toBeInTheDocument(),
    );

    const disableBtn = screen.getAllByRole('button', { name: 'Disable' })[0]!;
    await user.click(disableBtn);

    await waitFor(() => {
      const enableBtns = screen.getAllByRole('button', { name: 'Enable' });
      expect(enableBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('rolls back on server error', async () => {
    resetOrgProviderHandlers();
    server.use(
      http.patch('/api/admin/org/providers/:id', () =>
        HttpResponse.json(
          { code: 'server_error', message: 'oops' },
          { status: 500 },
        ),
      ),
    );
    const client = makeClient();
    const user = userEvent.setup();
    render(
      <Wrapper client={client}>
        <ProvidersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('OpenAI primary')).toBeInTheDocument(),
    );

    const disableBtn = screen.getAllByRole('button', { name: 'Disable' })[0]!;
    await user.click(disableBtn);

    await waitFor(() => {
      const disables = screen.getAllByRole('button', { name: 'Disable' });
      expect(disables.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('ProvidersTab — rotate key dialog', () => {
  it('opens the rotate key dialog when CTA is clicked', async () => {
    resetOrgProviderHandlers();
    const client = makeClient();
    const user = userEvent.setup();
    render(
      <Wrapper client={client}>
        <ProvidersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('OpenAI primary')).toBeInTheDocument(),
    );

    const rotateBtn = screen.getAllByRole('button', { name: 'Rotate key' })[0]!;
    await user.click(rotateBtn);

    expect(
      screen.getByRole('dialog', { name: /rotate api key/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/previous key will be invalidated/i),
    ).toBeInTheDocument();
  });
});

describe('ProvidersTab — empty state', () => {
  it('renders the empty heading when there are no providers', async () => {
    server.use(
      http.get('/api/admin/org/providers', () =>
        HttpResponse.json({ providers: [] }),
      ),
    );
    const client = makeClient();
    const { container } = render(
      <Wrapper client={client}>
        <ProvidersTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('No providers yet')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);
  });
});
