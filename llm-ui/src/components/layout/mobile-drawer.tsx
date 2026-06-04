import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Sidebar } from './sidebar';

export function MobileDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="md:hidden"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[240px] gap-0 p-0 sm:max-w-[240px]"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar variant="mobile" onItemSelect={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
