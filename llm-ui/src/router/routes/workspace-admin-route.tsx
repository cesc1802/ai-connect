import { createRoute, redirect } from '@tanstack/react-router';
import { adminRoute } from './admin-route';

function WorkspaceAdminShell() {
  return (
    <section
      aria-labelledby="workspace-admin-heading"
      className="text-foreground p-6"
    >
      <h1 id="workspace-admin-heading" className="text-2xl font-semibold">
        Workspace Admin
      </h1>
    </section>
  );
}

export const workspaceAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'workspace',
  beforeLoad: ({ context }) => {
    const role = context.session?.workspaceRole;
    if (role !== 'admin' && role !== 'owner') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: WorkspaceAdminShell,
});
