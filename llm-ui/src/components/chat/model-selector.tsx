import { useMemo } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import {
  useWorkspaceResources,
  workspaceResourcesQueryKey,
} from '@/hooks/use-workspace-resources';
import { useActiveChatModel } from '@/hooks/use-active-chat-model';
import type {
  Provider,
  WorkspaceResourcesResponse,
} from '@/schemas/resources';

type ModelSelectorProps = { className?: string };

const VALUE_SEP = '/';

function encodeValue(providerId: string, modelId: string) {
  return `${providerId}${VALUE_SEP}${modelId}`;
}

function decodeValue(value: string): { providerId: string; modelId: string } | null {
  const idx = value.indexOf(VALUE_SEP);
  if (idx <= 0 || idx === value.length - 1) return null;
  return { providerId: value.slice(0, idx), modelId: value.slice(idx + 1) };
}

function findModel(
  providers: Provider[],
  providerId: string,
  modelId: string,
): { provider: Provider; modelDisplayName: string } | null {
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) return null;
  const model = provider.models.find((m) => m.id === modelId);
  if (!model) return null;
  return { provider, modelDisplayName: model.displayName };
}

export function ModelSelector({ className }: ModelSelectorProps) {
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const { data, isLoading } = useWorkspaceResources(workspaceId);
  const { selection, setSelection } = useActiveChatModel();
  const queryClient = useQueryClient();

  const providers = data?.providers ?? [];
  const isEmpty = !isLoading && providers.length === 0;

  const currentMatch = useMemo(() => {
    if (!selection) return null;
    return findModel(providers, selection.providerId, selection.modelId);
  }, [providers, selection]);

  const currentLabel = isLoading
    ? '…'
    : currentMatch
      ? `${currentMatch.provider.displayName} · ${currentMatch.modelDisplayName}`
      : 'Select model';

  const currentValue = currentMatch && selection
    ? encodeValue(selection.providerId, selection.modelId)
    : '';

  const handleValueChange = (value: string) => {
    const decoded = decodeValue(value);
    if (!decoded) return;
    if (!workspaceId) return;

    const cached = queryClient.getQueryData<WorkspaceResourcesResponse>(
      workspaceResourcesQueryKey(workspaceId),
    );
    const live = cached?.providers ?? providers;
    const match = findModel(live, decoded.providerId, decoded.modelId);
    if (!match) {
      toast.error('That model is no longer available.');
      return;
    }
    setSelection(decoded);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isEmpty}
          title={
            isEmpty
              ? 'No models available — ask an admin to assign a provider.'
              : undefined
          }
          aria-label="Select chat model"
          className={cn('justify-between gap-2', className)}
        >
          <span className="truncate">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent role="listbox" align="start" className="min-w-64 p-0">
        <ScrollArea className="max-h-80">
          <div className="p-1">
            {isLoading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</div>
            ) : providers.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No models available — ask an admin to assign a provider.
              </div>
            ) : (
              <DropdownMenuRadioGroup
                value={currentValue}
                onValueChange={handleValueChange}
              >
                {providers.map((provider, idx) => (
                  <div key={provider.id}>
                    {idx > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuLabel>{provider.displayName}</DropdownMenuLabel>
                    {provider.models.map((model) => (
                      <DropdownMenuRadioItem
                        key={`${provider.id}/${model.id}`}
                        value={encodeValue(provider.id, model.id)}
                        role="option"
                      >
                        {model.displayName}
                      </DropdownMenuRadioItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuRadioGroup>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
