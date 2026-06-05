import { ChevronRight } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { OrgProviderRow } from '@/schemas/admin';
import type { ProviderKind } from '@/schemas/resources';

interface ProvidersSummaryCardProps {
  providers: OrgProviderRow[];
  loading?: boolean;
  onViewClick?: () => void;
  className?: string;
}

const PROVIDER_KIND_LABEL: Record<ProviderKind, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'azure-openai': 'Azure OpenAI',
  custom: 'Custom',
};

export function ProvidersSummaryCard({
  providers,
  loading = false,
  onViewClick,
  className,
}: ProvidersSummaryCardProps) {
  const enabled = providers.filter((p) => p.isEnabled).slice(0, 3);
  const visible = enabled.length > 0 ? enabled : providers.slice(0, 3);
  return (
    <section
      data-slot="providers-summary-card"
      aria-label="Providers"
      className={cn(
        'bg-card border-border rounded-xl border p-5',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Providers</h3>
        <button
          type="button"
          onClick={onViewClick}
          className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Xem <ChevronRight className="size-3" aria-hidden={true} />
        </button>
      </div>
      {loading ? (
        <ProvidersSummaryLoading />
      ) : visible.length === 0 ? (
        <p
          data-slot="providers-summary-empty"
          className="text-muted-foreground py-4 text-sm"
        >
          Chưa kết nối provider.
        </p>
      ) : (
        <ul className="space-y-2.5" role="list">
          {visible.map((p) => (
            <ProviderRow key={p.id} provider={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProviderRow({ provider }: { provider: OrgProviderRow }) {
  const kindLabel = PROVIDER_KIND_LABEL[provider.providerKind];
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden={true}
        className="bg-muted inline-flex size-8 shrink-0 items-center justify-center rounded-md"
      >
        <span className="text-muted-foreground text-[10px] font-semibold uppercase">
          {kindLabel.slice(0, 2)}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{provider.displayName}</div>
        <div className="text-muted-foreground truncate font-mono text-[11px]">
          {kindLabel} · ••••{provider.lastFour}
        </div>
      </div>
      <span
        data-slot="provider-status"
        data-enabled={provider.isEnabled ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
          provider.isEnabled
            ? 'bg-success/15 text-success border-success/25'
            : 'bg-muted text-muted-foreground border-transparent',
        )}
      >
        <span
          aria-hidden={true}
          className={cn(
            'inline-block size-1.5 rounded-full',
            provider.isEnabled ? 'bg-success' : 'bg-muted-foreground',
          )}
        />
        {provider.isEnabled ? 'Đã kết nối' : 'Tạm tắt'}
      </span>
    </li>
  );
}

function ProvidersSummaryLoading() {
  return (
    <div className="space-y-2.5" data-slot="providers-summary-loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
