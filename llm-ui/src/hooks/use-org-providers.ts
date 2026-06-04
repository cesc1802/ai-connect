import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  addOrgProvider,
  deleteOrgProvider,
  listOrgProviders,
  rotateOrgProviderKey,
  updateOrgProvider,
} from '@/api/admin-org-providers';
import type {
  AddOrgProviderRequest,
  OrgProviderResponse,
  OrgProviderRow,
  RotateOrgProviderKeyRequest,
} from '@/schemas/admin';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';

export const orgProvidersQueryKey = ['admin', 'org', 'providers'] as const;

export function useOrgProviders() {
  return useQuery<OrgProviderRow[]>({
    queryKey: orgProvidersQueryKey,
    queryFn: async () => {
      const { providers } = await listOrgProviders();
      return providers;
    },
  });
}

export function useAddOrgProvider() {
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    OrgProviderResponse,
    unknown,
    AddOrgProviderRequest
  > = {
    mutationFn: (vars) => addOrgProvider(vars),
    onSuccess: () => {
      toast.success('Provider added');
      queryClient.invalidateQueries({ queryKey: orgProvidersQueryKey });
    },
    onError: () => {
      toast.error('Failed to add provider');
    },
  };
  return useMutation(options);
}

interface ToggleVars {
  id: string;
  isEnabled: boolean;
}

export function useToggleOrgProvider() {
  return useOptimisticMutation<ToggleVars, OrgProviderRow>({
    queryKey: orgProvidersQueryKey,
    mutationFn: async ({ id, isEnabled }) => {
      const res = await updateOrgProvider(id, { isEnabled });
      return res.provider;
    },
    applyOptimistic: (rows, { id, isEnabled }) =>
      rows.map((r) => (r.id === id ? { ...r, isEnabled } : r)),
    successToast: (row) =>
      row.isEnabled ? 'Provider enabled' : 'Provider disabled',
    errorToast: () => 'Failed to update provider',
  });
}

interface RotateVars {
  id: string;
  apiKey: string;
}

export function useRotateOrgProviderKey() {
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    OrgProviderResponse,
    unknown,
    RotateVars
  > = {
    mutationFn: ({ id, apiKey }) =>
      rotateOrgProviderKey(id, { apiKey } satisfies RotateOrgProviderKeyRequest),
    onSuccess: () => {
      toast.success('API key rotated');
      queryClient.invalidateQueries({ queryKey: orgProvidersQueryKey });
    },
    onError: () => {
      toast.error('Failed to rotate key');
    },
  };
  return useMutation(options);
}

export function useDeleteOrgProvider() {
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, unknown, string> = {
    mutationFn: (id) => deleteOrgProvider(id),
    onSuccess: () => {
      toast.success('Provider removed');
      queryClient.invalidateQueries({ queryKey: orgProvidersQueryKey });
    },
    onError: () => {
      toast.error('Failed to remove provider');
    },
  };
  return useMutation(options);
}

