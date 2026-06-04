import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { getWsQuotas, patchWsQuotas } from '@/api/admin-ws-quotas';
import type {
  PatchQuotasRequest,
  QuotasListResponse,
  QuotasPatchResponse,
} from '@/schemas/admin';

export const wsQuotasQueryKey = ['admin', 'workspace', 'quotas'] as const;

export function useWsQuotas() {
  return useQuery<QuotasListResponse>({
    queryKey: wsQuotasQueryKey,
    queryFn: () => getWsQuotas(),
  });
}

interface MutationContext {
  previous: QuotasListResponse | undefined;
}

export function usePatchWsQuotas() {
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    QuotasPatchResponse,
    unknown,
    PatchQuotasRequest,
    MutationContext
  > = {
    mutationFn: (body) => patchWsQuotas(body),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: wsQuotasQueryKey });
      const previous = queryClient.getQueryData<QuotasListResponse>(
        wsQuotasQueryKey,
      );
      const isCommit = vars.force === true;
      if (previous && isCommit) {
        const overrides = new Map(vars.rows.map((r) => [r.role, r.maxRequests]));
        queryClient.setQueryData<QuotasListResponse>(wsQuotasQueryKey, {
          rows: previous.rows.map((row) =>
            overrides.has(row.role)
              ? { ...row, maxRequests: overrides.get(row.role)! }
              : row,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queueMicrotask(() => {
        if (context?.previous) {
          queryClient.setQueryData(wsQuotasQueryKey, context.previous);
        }
      });
      toast.error('Failed to update quotas');
    },
    onSuccess: (data, vars) => {
      const isCommit = vars.force === true;
      const isWarningResp = !!data.warnings && data.warnings.length > 0;
      if (!isWarningResp) {
        queryClient.setQueryData<QuotasListResponse>(wsQuotasQueryKey, {
          rows: data.rows,
        });
        if (isCommit || (vars.rows && vars.rows.length > 0)) {
          toast.success('Quotas updated');
        }
      }
    },
    onSettled: (data, _err, vars) => {
      const isWarningResp = !!data?.warnings && data.warnings.length > 0;
      if (isWarningResp) return;
      if (vars.force === true) {
        queryClient.invalidateQueries({ queryKey: wsQuotasQueryKey });
      }
    },
  };
  return useMutation(options);
}
