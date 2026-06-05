import * as React from 'react';

import { cn } from '@/lib/utils';

interface BrandMarkProps {
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export function BrandMark({
  size = 24,
  className,
  ariaLabel,
}: BrandMarkProps) {
  const labeled = Boolean(ariaLabel);
  return (
    <img
      data-slot="brand-mark"
      src="/brand/brand-mark.svg"
      width={size}
      height={size}
      alt={ariaLabel ?? ''}
      aria-hidden={labeled ? undefined : true}
      draggable={false}
      className={cn('select-none', className)}
    />
  );
}
