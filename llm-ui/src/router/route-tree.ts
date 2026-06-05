import { rootRoute } from './routes/root-route';
import { unauthenticatedRoute } from './routes/unauthenticated-route';
import { authenticatedRoute } from './routes/authenticated-route';
import { loginRoute } from './routes/login-route';
import { workspacePickRoute } from './routes/workspace-pick-route';
import { workspacesNewRoute } from './routes/workspaces-new-route';
import { noWorkspaceGuardRoute } from './routes/no-workspace-guard-route';
import { chatIndexRoute, chatConversationRoute } from './routes/chat-route';
import { devPrimitivesRoute } from './routes/dev-primitives-route';
import { adminRoute } from './routes/admin-route';
import { orgAdminRoute } from './routes/org-admin-route';
import { workspaceAdminRoute } from './routes/workspace-admin-route';
import { adminForbiddenRoute } from './routes/admin-forbidden-route';
import { overviewRoute } from './routes/overview-route';
import { membersRoute } from './routes/members-route';
import { accessMatrixRoute } from './routes/access-matrix-route';
import { workspacesListRoute } from './routes/workspaces-list-route';
import { workspaceDetailRoute } from './routes/workspace-detail-route';
import { providersRoute } from './routes/providers-route';
import { assignmentRoute } from './routes/assignment-route';
import { templatesRoute } from './routes/templates-route';

export const routeTree = rootRoute.addChildren([
  unauthenticatedRoute.addChildren([
    loginRoute,
    workspacePickRoute,
    workspacesNewRoute,
    noWorkspaceGuardRoute,
  ]),
  authenticatedRoute.addChildren([
    chatIndexRoute,
    chatConversationRoute,
    workspacesListRoute,
    workspaceDetailRoute,
    providersRoute,
    adminRoute.addChildren([
      orgAdminRoute,
      workspaceAdminRoute,
      adminForbiddenRoute,
      overviewRoute,
      membersRoute,
      accessMatrixRoute,
      assignmentRoute,
      templatesRoute,
    ]),
  ]),
  devPrimitivesRoute,
]);
