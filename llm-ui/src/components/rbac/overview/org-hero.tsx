import { CreditCard, UserPlus } from 'lucide-react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OrgHeroProps {
  orgName?: string;
  memberCount: number;
  workspaceCount: number;
  plan?: string;
  loading?: boolean;
  className?: string;
}

export function OrgHero({
  orgName = 'Công Ty ABC',
  memberCount,
  workspaceCount,
  plan = 'Business',
  loading = false,
  className,
}: OrgHeroProps) {
  return (
    <section
      data-slot="org-hero"
      aria-label="Tổ chức"
      className={cn(
        'bg-card border-border flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center',
        className,
      )}
    >
      <BrandLogo org={orgName} size={32} collapsed={true} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{orgName}</h2>
          <span
            data-slot="hero-status"
            className="bg-success/15 text-success border-success/25 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
          >
            Active
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm" data-slot="hero-tagline">
          Tổ chức ·{' '}
          {loading ? (
            <span className="text-muted-foreground/70">…</span>
          ) : (
            <>
              <span className="text-foreground font-medium">
                {memberCount} thành viên
              </span>{' '}
              · {workspaceCount} workspace
            </>
          )}{' '}
          · gói <span className="text-foreground font-medium">{plan}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          <CreditCard className="size-4" aria-hidden={true} />
          Billing
        </Button>
        <Button size="sm">
          <UserPlus className="size-4" aria-hidden={true} />
          Mời thành viên
        </Button>
      </div>
    </section>
  );
}
