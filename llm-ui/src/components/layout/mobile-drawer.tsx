import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sidebar } from './sidebar';

export function MobileDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="md:hidden"
        >
          <Menu className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-[272px] max-w-[85vw] gap-0 p-0 sm:max-w-[272px]"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <Sidebar onItemSelect={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
