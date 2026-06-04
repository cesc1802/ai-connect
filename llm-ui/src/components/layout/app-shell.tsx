import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useSidebarCollapsed } from '@/stores/sidebar-ui-store';
import { cn } from '@/lib/utils';

export function AppShell() {
  const collapsed = useSidebarCollapsed();
  return (
    <div
      className={cn(
        'grid h-full w-full grid-cols-1 transition-[grid-template-columns] duration-200 motion-reduce:transition-none md:grid-cols-[var(--sidebar-w)_1fr]',
      )}
      style={
        {
          '--sidebar-w': collapsed ? '64px' : '240px',
        } as React.CSSProperties
      }
    >
      <div className="hidden h-full min-h-0 md:block">
        <Sidebar />
      </div>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr] md:grid-rows-[1fr]">
        <Header />
        <main className="min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
