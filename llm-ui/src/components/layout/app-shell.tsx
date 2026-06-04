import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function AppShell() {
  return (
    <div className="grid h-full w-full grid-cols-1 md:grid-cols-[272px_1fr]">
      <div className="hidden h-full min-h-0 md:block">
        <Sidebar />
      </div>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
        <Header />
        <main className="min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
