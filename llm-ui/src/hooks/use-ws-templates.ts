import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  getWsTemplates,
  putWsTemplates,
  WsTemplatesEtagMismatchError,
  type WsTemplatesFetchResult,
} from '@/api/admin-ws-templates';
import type { PutWsTemplatesRequest } from '@/schemas/admin';

export const wsTemplatesQueryKey = ['admin', 'workspace', 'templates'] as const;

export function useWsTemplates() {
  return useQuery<WsTemplatesFetchResult>({
    queryKey: wsTemplatesQueryKey,
    queryFn: () => getWsTemplates(),
  });
}

interface PutVars {
  body: PutWsTemplatesRequest;
  ifMatch: string | null;
}

export function usePutWsTemplates() {
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    WsTemplatesFetchResult,
    unknown,
    PutVars
  > = {
    mutationFn: ({ body, ifMatch }) => putWsTemplates(body, ifMatch),
    onSuccess: (result) => {
      queryClient.setQueryData(wsTemplatesQueryKey, result);
      toast.success('Templates updated');
    },
    onError: (err) => {
      if (err instanceof WsTemplatesEtagMismatchError) {
        queryClient.invalidateQueries({ queryKey: wsTemplatesQueryKey });
        toast.error(
          'Bindings changed elsewhere. Your unsaved changes were discarded; try again.',
        );
        return;
      }
      toast.error('Failed to update templates');
    },
  };
  return useMutation(options);
}
