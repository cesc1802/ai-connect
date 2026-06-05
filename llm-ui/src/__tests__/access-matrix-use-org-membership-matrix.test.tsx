import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useOrgMembershipMatrix } from '@/hooks/use-org-membership-matrix';
import { resetOrgUserHandlers } from '@/mocks/handlers/admin-users';

afterEach(() => {
  resetOrgUserHandlers();
});

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useOrgMembershipMatrix', () => {
  it('returns users and workspaces after both queries settle', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useOrgMembershipMatrix(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.users.length).toBeGreaterThan(0);
    expect(result.current.workspaces.length).toBeGreaterThan(0);
  });

  it('produces a deterministic role for each (user, workspace) pair', async () => {
    const clientA = makeClient();
    const { result: a } = renderHook(() => useOrgMembershipMatrix(), {
      wrapper: wrapper(clientA),
    });
    await waitFor(() => expect(a.current.isLoading).toBe(false));

    const clientB = makeClient();
    const { result: b } = renderHook(() => useOrgMembershipMatrix(), {
      wrapper: wrapper(clientB),
    });
    await waitFor(() => expect(b.current.isLoading).toBe(false));

    const uid = a.current.users[0]!.id;
    const wsid = a.current.workspaces[0]!.id;
    expect(a.current.get(uid, wsid)).toBe(b.current.get(uid, wsid));
  });

  it('returns null for unknown pairs', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useOrgMembershipMatrix(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.get('does-not-exist', 'nope')).toBeNull();
  });
});
