import { createRoute, redirect } from '@tanstack/react-router';
import { adminRoute } from './admin-route';

function OrgAdminShell() {
  return (
    <section
      aria-labelledby="org-admin-heading"
      className="text-foreground p-6"
    >
      <h1 id="org-admin-heading" className="text-2xl font-semibold">
        Organization Admin
      </h1>
    </section>
  );
}

export const orgAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'org',
  beforeLoad: ({ context }) => {
    if (context.session?.orgRole !== 'admin') {
      throw redirect({ to: '/admin/403', replace: true });
    }
  },
  component: OrgAdminShell,
});
