import { Cpu, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/status-badge';
import { ProviderActionsMenu } from './provider-actions-menu';
import type { OrgProviderRow } from '@/schemas/admin';
import type { ProviderKind } from '@/schemas/resources';

const KIND_LABEL: Record<ProviderKind, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'azure-openai': 'Azure OpenAI',
  custom: 'Custom',
};

const KIND_ICON: Record<ProviderKind, LucideIcon> = {
  openai: Cpu,
  anthropic: Cpu,
  google: Cpu,
  'azure-openai': Cpu,
  custom: Cpu,
};

function formatMaskedKey(provider: OrgProviderRow): string {
  if (!provider.hasKey || !provider.lastFour) return '—';
  return `••••${provider.lastFour}`;
}

interface ProviderCardProps {
  provider: OrgProviderRow;
  onRotateKey: (provider: OrgProviderRow) => void;
  onToggleEnabled: (provider: OrgProviderRow) => void;
  onDelete: (provider: OrgProviderRow) => void;
}

export function ProviderCard({
  provider,
  onRotateKey,
  onToggleEnabled,
  onDelete,
}: ProviderCardProps) {
  const Icon = KIND_ICON[provider.providerKind];

  return (
    <Card
      data-slot="provider-card"
      data-provider-id={provider.id}
      data-provider-kind={provider.providerKind}
      className="gap-3"
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-3 text-base">
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{provider.displayName}</span>
          </span>
          <ProviderActionsMenu
            provider={provider}
            onRotateKey={onRotateKey}
            onToggleEnabled={onToggleEnabled}
            onDelete={onDelete}
          />
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          {KIND_LABEL[provider.providerKind]}
        </p>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <code
          data-slot="provider-card-key"
          className="font-mono text-sm"
          aria-label={`Khoá API kết thúc bằng ${provider.lastFour || 'không có'}`}
        >
          {formatMaskedKey(provider)}
        </code>
        {provider.isEnabled ? (
          <StatusBadge intent="active">Đang bật</StatusBadge>
        ) : (
          <StatusBadge intent="disabled">Đang tắt</StatusBadge>
        )}
      </CardContent>
    </Card>
  );
}
