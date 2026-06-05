import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type DeltaTrend = 'up' | 'down' | 'flat';

interface StatCardDelta {
  value: string;
  trend?: DeltaTrend;
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  delta?: StatCardDelta;
  className?: string;
}

const DELTA_CLASSES: Record<DeltaTrend, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  className,
}: StatCardProps) {
  const trend = delta?.trend ?? 'flat';
  return (
    <div
      data-slot="stat-card"
      className={cn(
        'bg-card text-card-foreground border-border flex flex-col gap-3 rounded-lg border p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <span
            data-slot="stat-card-icon"
            className="bg-muted text-muted-foreground inline-flex size-9 items-center justify-center rounded-md p-2"
            aria-hidden={true}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span data-slot="stat-card-value" className="text-2xl font-semibold">
          {value}
        </span>
        {delta ? (
          <span
            data-slot="stat-card-delta"
            data-trend={trend}
            className={cn('text-xs font-medium', DELTA_CLASSES[trend])}
          >
            {delta.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}
