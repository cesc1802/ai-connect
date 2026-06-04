import { rootRoute } from './routes/root-route';
import { unauthenticatedRoute } from './routes/unauthenticated-route';
import { authenticatedRoute } from './routes/authenticated-route';
import { loginRoute } from './routes/login-route';
import { workspacePickRoute } from './routes/workspace-pick-route';
import { chatIndexRoute, chatConversationRoute } from './routes/chat-route';
import { devPrimitivesRoute } from './routes/dev-primitives-route';

export const routeTree = rootRoute.addChildren([
  unauthenticatedRoute.addChildren([loginRoute, workspacePickRoute]),
  authenticatedRoute.addChildren([chatIndexRoute, chatConversationRoute]),
  devPrimitivesRoute,
]);
