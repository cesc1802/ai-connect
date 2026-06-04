import { createRouter } from '@tanstack/react-router';
import { routeTree } from './route-tree';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { session: null },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
