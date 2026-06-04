import * as React from 'react';
import {
  AlertTriangleIcon,
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  InfoIcon,
  XCircleIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

export type StatusIntent =
  | 'active'
  | 'pending'
  | 'disabled'
  | 'destructive'
  | 'warning'
  | 'info';

interface IntentSpec {
  classes: string;
  Icon: LucideIcon;
}

const INTENTS: Record<StatusIntent, IntentSpec> = {
  active: {
    classes: 'bg-success text-success-foreground',
    Icon: CheckCircle2Icon,
  },
  pending: {
    classes: 'bg-warning text-warning-foreground',
    Icon: ClockIcon,
  },
  warning: {
    classes: 'bg-warning text-warning-foreground',
    Icon: AlertTriangleIcon,
  },
  disabled: {
    classes: 'bg-muted text-muted-foreground',
    Icon: BanIcon,
  },
  destructive: {
    classes: 'bg-destructive text-destructive-foreground',
    Icon: XCircleIcon,
  },
  info: {
    classes: 'bg-secondary text-secondary-foreground',
    Icon: InfoIcon,
  },
};

interface StatusBadgeProps {
  intent: StatusIntent;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ intent, children, className }: StatusBadgeProps) {
  const { classes, Icon } = INTENTS[intent];
  return (
    <span
      data-slot="status-badge"
      data-intent={intent}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        classes,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden={true} />
      <span>{children}</span>
    </span>
  );
}
