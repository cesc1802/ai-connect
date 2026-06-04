import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BindingSplitPane } from '@/components/admin/workspace/binding-split-pane';
import {
  useWsTemplates,
  usePutWsTemplates,
} from '@/hooks/use-ws-templates';
import type {
  WsAvailableTemplate,
  WsBoundTemplate,
} from '@/schemas/admin';
import type { WorkspaceRole } from '@/schemas/auth';

const ROLE_OPTIONS: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];
const DEFAULT_ROLE: WorkspaceRole = 'member';

interface DraftPair {
  templateId: string;
  suggestedRole: WorkspaceRole;
}

export function WsTemplatesTab() {
  const query = useWsTemplates();
  const mutation = usePutWsTemplates();

  const [draftBound, setDraftBound] = React.useState<DraftPair[] | null>(null);

  React.useEffect(() => {
    setDraftBound(null);
  }, [query.data?.etag]);

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Failed to load templates.
      </p>
    );
  }

  const { available, bound } = query.data.data;

  const serverPairs: DraftPair[] = bound.map((b) => ({
    templateId: b.templateId,
    suggestedRole: b.suggestedRole,
  }));
  const effectivePairs = draftBound ?? serverPairs;
  const boundIdSet = new Set(effectivePairs.map((p) => p.templateId));

  const nameMap = new Map<string, string>();
  for (const a of available) nameMap.set(a.templateId, a.name);
  for (const b of bound) nameMap.set(b.templateId, b.name);

  const draftAvailable: WsAvailableTemplate[] = available.filter(
    (a) => !boundIdSet.has(a.templateId),
  );
  for (const b of bound) {
    if (!boundIdSet.has(b.templateId)) {
      draftAvailable.push({ templateId: b.templateId, name: b.name });
    }
  }
  const draftBoundView: WsBoundTemplate[] = effectivePairs.map((p) => ({
    templateId: p.templateId,
    name: nameMap.get(p.templateId) ?? p.templateId,
    suggestedRole: p.suggestedRole,
  }));

  const sortedDraft = [...effectivePairs].sort((a, b) =>
    a.templateId.localeCompare(b.templateId),
  );
  const sortedServer = [...serverPairs].sort((a, b) =>
    a.templateId.localeCompare(b.templateId),
  );
  const dirty =
    draftBound !== null &&
    (sortedDraft.length !== sortedServer.length ||
      sortedDraft.some(
        (p, i) =>
          p.templateId !== sortedServer[i]?.templateId ||
          p.suggestedRole !== sortedServer[i]?.suggestedRole,
      ));

  const onBind = (id: string) => {
    setDraftBound([
      ...effectivePairs,
      { templateId: id, suggestedRole: DEFAULT_ROLE },
    ]);
  };
  const onUnbind = (id: string) => {
    setDraftBound(effectivePairs.filter((p) => p.templateId !== id));
  };
  const onRoleChange = (id: string, role: WorkspaceRole) => {
    setDraftBound(
      effectivePairs.map((p) =>
        p.templateId === id ? { ...p, suggestedRole: role } : p,
      ),
    );
  };

  const onSave = () => {
    mutation.mutate({
      body: { templates: effectivePairs },
      ifMatch: query.data.etag,
    });
  };

  const onDiscard = () => setDraftBound(null);

  return (
    <div className="flex flex-col gap-4">
      <BindingSplitPane<WsAvailableTemplate, WsBoundTemplate>
        available={draftAvailable}
        bound={draftBoundView}
        getAvailableId={(x) => x.templateId}
        getAvailableLabel={(x) => x.name}
        getBoundId={(x) => x.templateId}
        getBoundLabel={(x) => x.name}
        onBind={onBind}
        onUnbind={onUnbind}
        availableHeading="Available templates"
        boundHeading="Bound to workspace"
        emptyPoolHeading="No templates in org pool"
        emptyPoolBody="Ask an org admin to publish a template before binding it here."
        emptyPoolCtaHref="/admin/org"
        emptyPoolCtaLabel="Open Org Admin"
        trailingSlot={(item) => (
          <Select
            value={item.suggestedRole}
            onValueChange={(v) =>
              onRoleChange(item.templateId, v as WorkspaceRole)
            }
          >
            <SelectTrigger
              size="sm"
              aria-label={`Suggested role for ${item.name}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDiscard}
          disabled={!dirty || mutation.isPending}
        >
          Discard
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={!dirty || mutation.isPending}
        >
          {mutation.isPending ? 'Saving…' : 'Save bindings'}
        </Button>
      </div>
    </div>
  );
}
