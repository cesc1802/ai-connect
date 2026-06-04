import { ThemeToggle } from '@/components/theme/theme-toggle';
import { UserMenu } from '@/components/auth/user-menu';
import { MobileDrawer } from './mobile-drawer';

export function Header() {
  return (
    <header className="bg-background border-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <MobileDrawer />
      <div className="text-sm font-semibold">AI Connect</div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
