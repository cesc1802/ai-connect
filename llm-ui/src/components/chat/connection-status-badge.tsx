import { cn } from '@/lib/utils';
import type { WSConnectionState } from '@/api/ws-client';

type ConnectionStatusBadgeProps = {
  status: WSConnectionState;
};

const LABELS: Record<WSConnectionState, string> = {
  idle: 'Offline',
  connecting: 'Connecting…',
  open: 'Connected',
  reconnecting: 'Reconnecting…',
  closed: 'Offline',
};

const TONES: Record<WSConnectionState, string> = {
  idle: 'bg-muted text-muted-foreground',
  connecting: 'bg-warning/15 text-warning',
  open: 'bg-success/15 text-success',
  reconnecting: 'bg-warning/15 text-warning',
  closed: 'bg-destructive/15 text-destructive',
};

export function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-full px-2 py-0.5 text-xs-plus font-medium',
        TONES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
