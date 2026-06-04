import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  createOrgTemplate,
  deleteOrgTemplate,
  listOrgTemplates,
  TemplateNameConflictError,
  updateOrgTemplate,
} from '@/api/admin-org-templates';
import type {
  OrgTemplateCreateRequest,
  OrgTemplateRow,
  OrgTemplateUpdateRequest,
} from '@/schemas/admin';
import { useOptimisticMutation } from './use-optimistic-mutation';

export const ORG_TEMPLATES_KEY = ['admin', 'org', 'templates'] as const;

export function useOrgTemplates() {
  return useQuery({
    queryKey: ORG_TEMPLATES_KEY,
    queryFn: async () => (await listOrgTemplates()).templates,
  });
}

export function useCreateOrgTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrgTemplateCreateRequest) => createOrgTemplate(body),
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: ORG_TEMPLATES_KEY });
      toast.success(`Created "${row.name}"`);
    },
    onError: (err: unknown) => {
      if (!(err instanceof TemplateNameConflictError)) {
        toast.error('Could not create template');
      }
    },
  });
}

export function useUpdateOrgTemplate() {
  return useOptimisticMutation<
    { id: string; patch: OrgTemplateUpdateRequest; previous: OrgTemplateRow },
    OrgTemplateRow
  >({
    queryKey: ORG_TEMPLATES_KEY,
    mutationFn: ({ id, patch }) => updateOrgTemplate(id, patch),
    applyOptimistic: (rows, { id, patch, previous }) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              updatedAt: previous.updatedAt,
            }
          : r,
      ),
    successToast: (row) => `Saved "${row.name}"`,
    errorToast: (err) =>
      err instanceof TemplateNameConflictError
        ? 'A template with this name already exists'
        : 'Could not save template',
  });
}

export function useDeleteOrgTemplate() {
  return useOptimisticMutation<{ row: OrgTemplateRow }, OrgTemplateRow>({
    queryKey: ORG_TEMPLATES_KEY,
    mutationFn: async ({ row }) => {
      await deleteOrgTemplate(row.id);
      return row;
    },
    applyOptimistic: (rows, { row }) => rows.filter((r) => r.id !== row.id),
    successToast: (row) => `Deleted "${row.name}"`,
    errorToast: () => 'Could not delete template',
  });
}
