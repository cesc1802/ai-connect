import * as React from 'react';

import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';

interface BrandLogoProps {
  org?: string;
  collapsed?: boolean;
  size?: number;
  className?: string;
}

export function BrandLogo({
  org = 'Công Ty ABC',
  collapsed = false,
  size = 28,
  className,
}: BrandLogoProps) {
  return (
    <span
      data-slot="brand-logo"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <BrandMark size={size} ariaLabel={collapsed ? org : undefined} />
      {collapsed ? null : (
        <span className="text-sidebar-primary truncate text-base font-bold tracking-tight">
          {org}
        </span>
      )}
    </span>
  );
}
