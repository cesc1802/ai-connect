import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import type { ReactNode } from 'react';

import { QuotasTab } from '@/components/admin/workspace/quotas-tab';
import {
  resetWsQuotasHandlers,
  setWsQuotaUsage,
} from '@/mocks/handlers/admin-ws-quotas-handlers';
import { useAuthStore } from '@/stores/auth-store';
import {
  DEMO_ACCESS_TOKEN,
  DEMO_USER,
  DEMO_EXPIRES_IN_SEC,
} from '@/mocks/fixtures/users';

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

describe('QuotasTab', () => {
  beforeEach(() => {
    resetWsQuotasHandlers();
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
  });

  it('renders seeded role rows', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <QuotasTab />
      </Wrapper>,
    );
    await screen.findByRole('table');
    expect(screen.getByLabelText('Max requests for owner')).toBeInTheDocument();
    expect(screen.getByLabelText('Max requests for admin')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Max requests for member'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Max requests for viewer'),
    ).toBeInTheDocument();
  });

  it('save without warnings rebases to server state', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <QuotasTab />
      </Wrapper>,
    );
    await screen.findByRole('table');

    const memberInput = screen.getByLabelText(
      'Max requests for member',
    ) as HTMLInputElement;
    await user.clear(memberInput);
    await user.type(memberInput, '321');
    const saveBtn = screen.getByRole('button', { name: /Save changes/ });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Max requests for member') as HTMLInputElement)
          .value,
      ).toBe('321');
    });
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
  });

  it('save with over-count warning opens confirm dialog with usage rows', async () => {
    setWsQuotaUsage({ member: 250 });
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <QuotasTab />
      </Wrapper>,
    );
    await screen.findByRole('table');

    const memberInput = screen.getByLabelText('Max requests for member');
    await user.clear(memberInput);
    await user.type(memberInput, '100');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Lower than current usage/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/member/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/current usage: 250/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Apply anyway/ }),
    ).toBeInTheDocument();
  });

  it('confirming over-count sends force=true and persists', async () => {
    setWsQuotaUsage({ member: 250 });
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <QuotasTab />
      </Wrapper>,
    );
    await screen.findByRole('table');

    const memberInput = screen.getByLabelText('Max requests for member');
    await user.clear(memberInput);
    await user.type(memberInput, '100');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: /Apply anyway/ }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      (screen.getByLabelText('Max requests for member') as HTMLInputElement)
        .value,
    ).toBe('100');
  });

  it('is axe-clean in loaded state', async () => {
    const client = makeClient();
    const { container } = render(
      <Wrapper client={client}>
        <QuotasTab />
      </Wrapper>,
    );
    await screen.findByRole('table');
    const results = await axe(container);
    const serious = (results.violations ?? []).filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toEqual([]);
  });
});
