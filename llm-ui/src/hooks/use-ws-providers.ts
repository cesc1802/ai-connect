import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  getWsProviders,
  putWsProviders,
  WsProvidersEtagMismatchError,
  type WsProvidersFetchResult,
} from '@/api/admin-ws-providers';
import type { PutWsProvidersRequest } from '@/schemas/admin';

export const wsProvidersQueryKey = ['admin', 'workspace', 'providers'] as const;

export function useWsProviders() {
  return useQuery<WsProvidersFetchResult>({
    queryKey: wsProvidersQueryKey,
    queryFn: () => getWsProviders(),
  });
}

interface PutVars {
  body: PutWsProvidersRequest;
  ifMatch: string | null;
}

export function usePutWsProviders() {
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    WsProvidersFetchResult,
    unknown,
    PutVars
  > = {
    mutationFn: ({ body, ifMatch }) => putWsProviders(body, ifMatch),
    onSuccess: (result) => {
      queryClient.setQueryData(wsProvidersQueryKey, result);
      toast.success('Providers updated');
    },
    onError: (err) => {
      if (err instanceof WsProvidersEtagMismatchError) {
        queryClient.invalidateQueries({ queryKey: wsProvidersQueryKey });
        toast.error(
          'Bindings changed elsewhere. Your unsaved changes were discarded; try again.',
        );
        return;
      }
      toast.error('Failed to update providers');
    },
  };
  return useMutation(options);
}
