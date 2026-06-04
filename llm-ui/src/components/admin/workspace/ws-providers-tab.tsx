import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BindingSplitPane } from '@/components/admin/workspace/binding-split-pane';
import {
  useWsProviders,
  usePutWsProviders,
} from '@/hooks/use-ws-providers';
import type { WsProviderItem } from '@/schemas/admin';

export function WsProvidersTab() {
  const query = useWsProviders();
  const mutation = usePutWsProviders();

  const [draftBoundIds, setDraftBoundIds] = React.useState<string[] | null>(
    null,
  );

  const serverBoundIds = React.useMemo(
    () => query.data?.data.bound.map((p) => p.id) ?? null,
    [query.data],
  );

  React.useEffect(() => {
    setDraftBoundIds(null);
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
        Failed to load providers.
      </p>
    );
  }

  const { available, bound } = query.data.data;
  const effectiveBoundIds =
    draftBoundIds ?? bound.map((p) => p.id);
  const boundSet = new Set(effectiveBoundIds);

  const lookup = new Map<string, WsProviderItem>();
  for (const p of available) lookup.set(p.id, p);
  for (const p of bound) lookup.set(p.id, p);

  const draftAvailable: WsProviderItem[] = [];
  const draftBound: WsProviderItem[] = [];
  for (const p of available) {
    (boundSet.has(p.id) ? draftBound : draftAvailable).push(p);
  }
  for (const p of bound) {
    if (boundSet.has(p.id) && !draftBound.find((x) => x.id === p.id)) {
      draftBound.push(p);
    } else if (!boundSet.has(p.id) && !draftAvailable.find((x) => x.id === p.id)) {
      draftAvailable.push(p);
    }
  }

  const dirty =
    serverBoundIds !== null &&
    (draftBoundIds !== null) &&
    (draftBoundIds.length !== serverBoundIds.length ||
      draftBoundIds.some((id) => !serverBoundIds.includes(id)) ||
      serverBoundIds.some((id) => !draftBoundIds.includes(id)));

  const onBind = (id: string) => {
    setDraftBoundIds([...effectiveBoundIds, id]);
  };
  const onUnbind = (id: string) => {
    setDraftBoundIds(effectiveBoundIds.filter((x) => x !== id));
  };

  const onSave = () => {
    mutation.mutate({
      body: { providerIds: effectiveBoundIds },
      ifMatch: query.data.etag,
    });
  };

  const onDiscard = () => setDraftBoundIds(null);

  return (
    <div className="flex flex-col gap-4">
      <BindingSplitPane<WsProviderItem, WsProviderItem>
        available={draftAvailable}
        bound={draftBound}
        getAvailableId={(x) => x.id}
        getAvailableLabel={(x) => x.displayName}
        getBoundId={(x) => x.id}
        getBoundLabel={(x) => x.displayName}
        onBind={onBind}
        onUnbind={onUnbind}
        availableHeading="Available providers"
        boundHeading="Bound to workspace"
        emptyPoolHeading="No providers in org pool"
        emptyPoolBody="Ask an org admin to add a provider before binding it here."
        emptyPoolCtaHref="/admin/org"
        emptyPoolCtaLabel="Open Org Admin"
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
