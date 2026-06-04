import { useQuery } from '@tanstack/react-query';
import { listTemplates } from '@/api/templates';
import type { TemplateListResponse } from '@/schemas/template';

export function templatesQueryKey(workspaceId: string) {
  return ['workspaces', workspaceId, 'templates'] as const;
}

export function useTemplates(workspaceId: string | null) {
  return useQuery<TemplateListResponse>({
    queryKey: templatesQueryKey(workspaceId ?? ''),
    queryFn: () => listTemplates(workspaceId!),
    enabled: workspaceId != null,
  });
}
