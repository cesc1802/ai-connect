import { createRoute, Outlet } from '@tanstack/react-router';
import { rootRoute } from './root-route';

function UnauthenticatedLayout() {
  return (
    <div className="bg-background flex h-full w-full items-center justify-center overflow-auto p-4">
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}

export const unauthenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'unauthenticated',
  component: UnauthenticatedLayout,
});
