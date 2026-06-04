import type { ReactNode } from 'react';
import { Splash } from '@/components/feedback/splash';
import { useRefreshSession } from '@/hooks/use-refresh-session';

/**
 * Wraps the router so the boot-time session restore completes before any
 * route guard runs. While pending → Splash; after either success or failure
 * → children render and the router decides where to land.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { status } = useRefreshSession();
  if (status === 'pending') return <Splash label="Restoring session…" />;
  return <>{children}</>;
}
