import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './root-route';
import { PrimitivesDemo } from '@/components/_dev/primitives-demo';

export const devPrimitivesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/_dev/primitives',
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: '/login' });
    }
  },
  component: PrimitivesDemo,
});
