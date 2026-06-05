import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OrgProviderRow } from '@/schemas/admin';

interface ProviderActionsMenuProps {
  provider: OrgProviderRow;
  onRotateKey: (provider: OrgProviderRow) => void;
  onToggleEnabled: (provider: OrgProviderRow) => void;
  onDelete: (provider: OrgProviderRow) => void;
}

export function ProviderActionsMenu({
  provider,
  onRotateKey,
  onToggleEnabled,
  onDelete,
}: ProviderActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Hành động cho ${provider.displayName}`}
          data-testid={`provider-actions-trigger-${provider.id}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onRotateKey(provider)}>
          Đổi key
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onToggleEnabled(provider)}>
          {provider.isEnabled ? 'Tắt' : 'Bật'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onDelete(provider)}
          className="text-destructive focus:text-destructive"
        >
          Xoá
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
