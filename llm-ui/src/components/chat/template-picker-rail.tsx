import { useMemo } from 'react';

import { useTemplates } from '@/hooks/use-templates';
import { useApplyTemplate } from '@/hooks/use-apply-template';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { Skeleton } from '@/components/ui/skeleton';
import type { Template, TemplateScope } from '@/schemas/template';
import { WorkspaceTemplateGroup } from './workspace-template-group';

const SCOPE_LABELS: Record<TemplateScope, string> = {
  workspace: 'Workspace',
  personal: 'Cá nhân',
  suggested: 'Gợi ý',
};

const SCOPE_ORDER: TemplateScope[] = ['workspace', 'personal', 'suggested'];

function groupByScope(templates: Template[]): Record<TemplateScope, Template[]> {
  const acc: Record<TemplateScope, Template[]> = {
    workspace: [],
    personal: [],
    suggested: [],
  };
  for (const t of templates) {
    acc[t.scope].push(t);
  }
  return acc;
}

export function TemplatePickerRail() {
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const query = useTemplates(workspaceId);
  const apply = useApplyTemplate();

  const templates = query.data?.templates ?? [];
  const grouped = useMemo(() => groupByScope(templates), [templates]);

  return (
    <aside
      aria-label="Mẫu prompt"
      className="border-border bg-card flex h-full flex-col gap-2 overflow-y-auto border-r p-3"
    >
      <header className="px-1">
        <h2 className="text-sm font-semibold">Mẫu prompt</h2>
        <p className="text-muted-foreground text-xs">
          Bấm để áp dụng vào tin nhắn.
        </p>
      </header>

      {query.isLoading && (
        <div className="flex flex-col gap-2 px-1">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      )}

      {!query.isLoading && templates.length === 0 && (
        <p className="text-muted-foreground px-1 py-2 text-xs">
          Chưa có mẫu nào trong workspace này.
        </p>
      )}

      {!query.isLoading && templates.length > 0 && (
        <div className="flex flex-col gap-2">
          {SCOPE_ORDER.map((scope) => (
            <WorkspaceTemplateGroup
              key={scope}
              label={SCOPE_LABELS[scope]}
              templates={grouped[scope]}
              onApply={apply}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
