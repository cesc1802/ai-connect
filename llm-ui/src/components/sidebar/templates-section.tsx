import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useTemplates } from '@/hooks/use-templates';
import { useApplyTemplate } from '@/hooks/use-apply-template';
import { useRouterSession } from '@/hooks/use-router-session';
import { ChatSearch } from './chat-search';
import type { Template } from '@/schemas/template';
import type { WorkspaceRole } from '@/schemas/auth';

type TemplateGroups = {
  suggested: Template[];
  workspace: Template[];
  personal: Template[];
};

function filterAndGroup(
  templates: Template[],
  role: WorkspaceRole | null,
  q: string,
): TemplateGroups {
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? templates.filter((t) => t.name.toLowerCase().includes(needle))
    : templates;
  return {
    suggested: matches.filter(
      (t) => t.scope === 'suggested' && (!t.role || t.role === role),
    ),
    workspace: matches.filter((t) => t.scope === 'workspace'),
    personal: matches.filter((t) => t.scope === 'personal'),
  };
}

function TemplateRow({
  template,
  onApply,
}: {
  template: Template;
  onApply: (t: Template) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onApply(template)}
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors motion-reduce:transition-none"
    >
      <span className="truncate font-medium">{template.name}</span>
    </button>
  );
}

function TemplateGroupList({
  label,
  items,
  onApply,
  emptyMessage,
}: {
  label: string;
  items: Template[];
  onApply: (t: Template) => void;
  emptyMessage?: string;
}) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-sidebar-foreground/70 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground px-3 py-1 text-xs">{emptyMessage}</p>
      ) : (
        items.map((t) => (
          <TemplateRow key={t.id} template={t} onApply={onApply} />
        ))
      )}
    </div>
  );
}

export function TemplatesSection() {
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const session = useRouterSession();
  const query = useTemplates(workspaceId);
  const apply = useApplyTemplate();
  const [search, setSearch] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);

  const templates = query.data?.templates ?? [];
  const workspaceRole = session?.workspaceRole ?? null;
  const groups = useMemo(
    () => filterAndGroup(templates, workspaceRole, search),
    [templates, workspaceRole, search],
  );

  function handleApply(t: Template): void {
    setBrowserOpen(false);
    apply(t);
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="text-muted-foreground px-3 py-2 text-xs">
        No templates available in this workspace yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex-1">
          <ChatSearch value={search} onChange={setSearch} />
        </div>
        <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground gap-1 text-xs"
              aria-label="Open all templates"
            >
              All <ArrowRight className="size-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>All Templates</DialogTitle>
            </DialogHeader>
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleApply(t)}
                  className="hover:bg-accent hover:text-accent-foreground flex flex-col items-start gap-1 rounded-md border p-3 text-left"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">
                    {t.body}
                  </span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-1">
        <TemplateGroupList
          label="Suggested for You"
          items={groups.suggested}
          onApply={apply}
          emptyMessage="Nothing suggested for your role yet."
        />
        <TemplateGroupList
          label="Workspace"
          items={groups.workspace}
          onApply={apply}
        />
        <TemplateGroupList
          label="My Templates"
          items={groups.personal}
          onApply={apply}
        />
      </div>
    </div>
  );
}
