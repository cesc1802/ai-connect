import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';

interface Row {
  id: string;
  name: string;
}

const KEY = ['admin', 'rows'];

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeClient(seed: Row[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData<Row[]>(KEY, seed);
  return qc;
}

describe('useOptimisticMutation', () => {
  it('applies the optimistic row immediately and confirms on success', async () => {
    const qc = makeClient([{ id: '1', name: 'Ada' }]);
    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ name: string }, Row>({
          queryKey: KEY,
          mutationFn: async ({ name }) => ({ id: '2', name }),
          applyOptimistic: (rows, v) => [
            ...rows,
            { id: 'optimistic', name: v.name },
          ],
        }),
      { wrapper: wrapper(qc) },
    );
    await act(async () => {
      await result.current.mutateAsync({ name: 'Alan' });
    });
    await waitFor(() => {
      const rows = qc.getQueryData<Row[]>(KEY) ?? [];
      expect(rows.some((r) => r.name === 'Alan')).toBe(true);
    });
  });

  it('rolls the cache back within a microtask on a rejected mutation', async () => {
    const qc = makeClient([{ id: '1', name: 'Ada' }]);
    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ name: string }, Row>({
          queryKey: KEY,
          mutationFn: async () => {
            throw new Error('boom');
          },
          applyOptimistic: (rows, v) => [
            ...rows,
            { id: 'optimistic', name: v.name },
          ],
        }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const p = result.current.mutateAsync({ name: 'Alan' });
      await expect(p).rejects.toThrow('boom');
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    const rows = qc.getQueryData<Row[]>(KEY) ?? [];
    expect(rows).toEqual([{ id: '1', name: 'Ada' }]);
  });

  it('a double-fire failed mutation does not leave a stale optimistic row', async () => {
    const qc = makeClient([{ id: '1', name: 'Ada' }]);
    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ name: string }, Row>({
          queryKey: KEY,
          mutationFn: async () => {
            throw new Error('boom');
          },
          applyOptimistic: (rows, v) => [
            ...rows,
            { id: 'optimistic', name: v.name },
          ],
        }),
      { wrapper: wrapper(qc) },
    );

    await act(async () => {
      const a = result.current.mutateAsync({ name: 'Alan' });
      const b = result.current.mutateAsync({ name: 'Grace' });
      await Promise.allSettled([a, b]);
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    const rows = qc.getQueryData<Row[]>(KEY) ?? [];
    expect(rows.some((r) => r.id === 'optimistic')).toBe(false);
  });
});
