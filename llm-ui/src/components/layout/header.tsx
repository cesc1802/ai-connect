import { MobileDrawer } from './mobile-drawer';

/**
 * Mobile-only top bar (< md). On desktop the sidebar owns chrome (theme toggle
 * + switcher + account), so this row is hidden.
 */
export function Header() {
  return (
    <header className="bg-background border-border flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
      <MobileDrawer />
      <div className="text-sm font-semibold">AI Connect</div>
    </header>
  );
}
