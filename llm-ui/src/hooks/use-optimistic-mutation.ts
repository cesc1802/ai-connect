import * as React from 'react';
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

interface UseOptimisticMutationOptions<TVar, TRow> {
  queryKey: QueryKey;
  mutationFn: (variables: TVar) => Promise<TRow>;
  applyOptimistic: (rows: TRow[], variables: TVar) => TRow[];
  successToast?: (row: TRow) => string;
  errorToast?: (error: unknown) => string;
}

interface RollbackContext<TRow> {
  previous: TRow[] | undefined;
}

export function useOptimisticMutation<TVar, TRow>(
  options: UseOptimisticMutationOptions<TVar, TRow>,
) {
  const {
    queryKey,
    mutationFn,
    applyOptimistic,
    successToast,
    errorToast,
  } = options;
  const queryClient = useQueryClient();
  const inFlightRef = React.useRef<{ count: number; snapshot: TRow[] | undefined }>(
    { count: 0, snapshot: undefined },
  );

  const mutationOptions: UseMutationOptions<
    TRow,
    unknown,
    TVar,
    RollbackContext<TRow>
  > = {
    mutationKey: queryKey,
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      if (inFlightRef.current.count === 0) {
        inFlightRef.current.snapshot = queryClient.getQueryData<TRow[]>(queryKey);
      }
      inFlightRef.current.count += 1;
      const previous = inFlightRef.current.snapshot;
      queryClient.setQueryData<TRow[]>(queryKey, (current) =>
        applyOptimistic(current ?? [], variables),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      queueMicrotask(() => {
        queryClient.setQueryData<TRow[] | undefined>(
          queryKey,
          context?.previous,
        );
      });
      if (errorToast) toast.error(errorToast(error));
    },
    onSuccess: (row) => {
      if (successToast) toast.success(successToast(row));
    },
    onSettled: () => {
      inFlightRef.current.count = Math.max(0, inFlightRef.current.count - 1);
      if (inFlightRef.current.count === 0) {
        inFlightRef.current.snapshot = undefined;
        queryClient.invalidateQueries({ queryKey });
      }
    },
  };

  return useMutation(mutationOptions);
}
