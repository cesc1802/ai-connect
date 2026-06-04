import { Monitor, Moon, Sun } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useThemeStore, type Theme } from '@/stores/theme-store';
import { cn } from '@/lib/utils';

type PreferencesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>
            Personal display and assistant settings. These apply across all
            workspaces.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Theme</span>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="grid grid-cols-3 gap-2"
            >
              {THEMES.map(({ value, label, Icon }) => {
                const active = theme === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    variant={active ? 'default' : 'outline'}
                    className={cn('flex items-center gap-2')}
                    onClick={() => setTheme(value)}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Language</span>
            <p className="text-muted-foreground text-xs">
              English (only language available).
            </p>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Default model</span>
            <p className="text-muted-foreground text-xs">
              Defaults are managed per workspace (Workspace · Providers).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
