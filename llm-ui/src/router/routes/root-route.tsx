import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { NotFound } from '@/components/layout/not-found';

// Placeholder session shape — Phase 4 replaces this with the real store.
// TODO(phase-04): import SessionState from '@/stores/session-store'.
export type SessionState = {
  userId: string;
  workspaceId: string | null;
};

export type RouterContext = {
  session: SessionState | null;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
