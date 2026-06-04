import * as React from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/admin/empty-state';
import { useAuthStore } from '@/stores/auth-store';

export interface BindingSplitPaneProps<TAvailable, TBound> {
  available: readonly TAvailable[];
  bound: readonly TBound[];
  getAvailableId: (item: TAvailable) => string;
  getAvailableLabel: (item: TAvailable) => string;
  getBoundId: (item: TBound) => string;
  getBoundLabel: (item: TBound) => string;
  onBind: (id: string) => void;
  onUnbind: (id: string) => void;
  availableHeading?: string;
  boundHeading?: string;
  emptyPoolHeading: string;
  emptyPoolBody: string;
  emptyPoolCtaHref?: string;
  emptyPoolCtaLabel?: string;
  trailingSlot?: (item: TBound) => React.ReactNode;
}

export function BindingSplitPane<TAvailable, TBound>(
  props: BindingSplitPaneProps<TAvailable, TBound>,
) {
  const {
    available,
    bound,
    getAvailableId,
    getAvailableLabel,
    getBoundId,
    getBoundLabel,
    onBind,
    onUnbind,
    availableHeading = 'Available',
    boundHeading = 'Bound',
    emptyPoolHeading,
    emptyPoolBody,
    emptyPoolCtaHref,
    emptyPoolCtaLabel,
    trailingSlot,
  } = props;

  const orgRole = useAuthStore((s) => s.user?.orgRole);
  const poolIsEmpty = available.length === 0 && bound.length === 0;

  if (poolIsEmpty) {
    const showCta =
      orgRole === 'admin' && emptyPoolCtaHref && emptyPoolCtaLabel;
    return (
      <EmptyState
        heading={emptyPoolHeading}
        body={emptyPoolBody}
        action={
          showCta ? (
            <a
              href={emptyPoolCtaHref}
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              {emptyPoolCtaLabel}
            </a>
          ) : undefined
        }
      />
    );
  }

  return (
    <div
      data-slot="binding-split-pane"
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <section
        aria-labelledby="binding-available-heading"
        className="rounded-md border"
      >
        <header className="border-b px-3 py-2">
          <h3
            id="binding-available-heading"
            className="text-sm font-semibold"
          >
            {availableHeading}
          </h3>
        </header>
        {available.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            Nothing left to bind.
          </p>
        ) : (
          <ul className="divide-y" role="list">
            {available.map((item) => {
              const id = getAvailableId(item);
              const label = getAvailableLabel(item);
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-sm">{label}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Bind ${label}`}
                    onClick={() => onBind(id)}
                  >
                    &rsaquo;
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="binding-bound-heading"
        className="rounded-md border"
      >
        <header className="border-b px-3 py-2">
          <h3 id="binding-bound-heading" className="text-sm font-semibold">
            {boundHeading}
          </h3>
        </header>
        {bound.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            Nothing bound yet.
          </p>
        ) : (
          <ul className="divide-y" role="list">
            {bound.map((item) => {
              const id = getBoundId(item);
              const label = getBoundLabel(item);
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="flex flex-1 items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Unbind ${label}`}
                      onClick={() => onUnbind(id)}
                    >
                      &lsaquo;
                    </Button>
                    <span className="text-sm">{label}</span>
                  </div>
                  {trailingSlot ? (
                    <div className="shrink-0">{trailingSlot(item)}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
