import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProviderCard } from './provider-card';
import type { OrgProviderRow } from '@/schemas/admin';

interface ProviderGridProps {
  providers: OrgProviderRow[];
  onAddProvider: () => void;
  onRotateKey: (provider: OrgProviderRow) => void;
  onToggleEnabled: (provider: OrgProviderRow) => void;
  onDelete: (provider: OrgProviderRow) => void;
}

export function ProviderGrid({
  providers,
  onAddProvider,
  onRotateKey,
  onToggleEnabled,
  onDelete,
}: ProviderGridProps) {
  return (
    <div
      data-slot="provider-grid"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          onRotateKey={onRotateKey}
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAddProvider}
        data-slot="provider-grid-add"
        data-testid="provider-grid-add"
        className="border-border text-muted-foreground hover:text-foreground hover:bg-accent flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-transparent"
      >
        <Plus className="size-5" aria-hidden="true" />
        <span className="text-sm font-medium">Thêm provider</span>
      </Button>
    </div>
  );
}
