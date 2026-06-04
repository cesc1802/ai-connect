import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import type { ReactNode } from 'react';

import { RolesTab } from '@/components/admin/workspace/roles-tab';

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

describe('RolesTab', () => {
  it('renders the four-role catalogue from the API', async () => {
    const client = makeClient();
    render(
      <Wrapper client={client}>
        <RolesTab />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText('Owner')).toBeInTheDocument(),
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('is axe-clean in loaded state in both themes', async () => {
    const client = makeClient();
    const { container, rerender } = render(
      <Wrapper client={client}>
        <RolesTab />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(screen.getByText('Owner')).toBeInTheDocument(),
    );
    await expectNoSeriousAxe(container);

    rerender(
      <div className="dark">
        <Wrapper client={client}>
          <RolesTab />
        </Wrapper>
      </div>,
    );
    await expectNoSeriousAxe(container);
  });
});
