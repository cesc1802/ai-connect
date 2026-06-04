import type { ReactNode } from 'react';
import { Splash } from '@/components/feedback/splash';
import { useRefreshSession } from '@/hooks/use-refresh-session';
import { useLandingDecision } from '@/hooks/use-landing-decision';

/**
 * Wraps the router so the boot-time session restore AND the UC-036 landing
 * decision both complete before any route guard runs. While either step is
 * pending → Splash; after both resolve → children render and the router
 * (re-)evaluates whatever URL the landing decision committed to.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { status: refreshStatus } = useRefreshSession();
  const { status: landingStatus } = useLandingDecision(refreshStatus === 'ready');
  if (refreshStatus === 'pending') return <Splash label="Restoring session…" />;
  if (landingStatus === 'pending') return <Splash label="Loading workspaces…" />;
  return <>{children}</>;
}
