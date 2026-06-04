import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { NotFound } from '@/components/layout/not-found';
import type { OrgRole, WorkspaceRole } from '@/schemas/auth';

export type SessionState = {
  userId: string;
  workspaceId: string | null;
  orgRole: OrgRole;
  workspaceRole: WorkspaceRole | null;
};

export type RouterContext = {
  session: SessionState | null;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
