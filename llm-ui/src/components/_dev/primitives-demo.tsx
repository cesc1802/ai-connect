import { useState } from 'react';
import { Info, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export function PrimitivesDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Primitives Demo</h1>
            <p className="text-muted-foreground text-sm">
              Visual sanity check for shadcn/ui primitives in light + dark themes.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Separator />

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="xs">xs</Button>
            <Button size="sm">sm</Button>
            <Button size="default">default</Button>
            <Button size="lg">large</Button>
            <Button size="icon" aria-label="sparkles">
              <Sparkles />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description with muted color.</CardDescription>
              <CardAction>
                <Button size="sm" variant="outline">
                  Action
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>Body content sits here.</CardContent>
            <CardFooter>
              <Button size="sm">Confirm</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Input / Label / Form fields">
          <div className="grid max-w-sm gap-3">
            <Label htmlFor="demo-email">Email</Label>
            <Input id="demo-email" type="email" placeholder="you@example.com" />
            <Label htmlFor="demo-pass">Password</Label>
            <Input id="demo-pass" type="password" placeholder="••••••••" />
            <Input disabled placeholder="Disabled input" />
            <Input aria-invalid placeholder="aria-invalid input" />
          </div>
        </Section>

        <Section title="Select">
          <Select>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Pick a workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ws-1">Workspace One</SelectItem>
              <SelectItem value="ws-2">Workspace Two</SelectItem>
              <SelectItem value="ws-3">Workspace Three</SelectItem>
            </SelectContent>
          </Select>
        </Section>

        <Section title="Dialog">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm action</DialogTitle>
                <DialogDescription>
                  This is a sample dialog rendered through the Radix primitive.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Dropdown menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="Tooltip">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="info">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip content</TooltipContent>
          </Tooltip>
        </Section>

        <Section title="Toast (sonner)">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => toast('Plain toast')}>Plain</Button>
            <Button onClick={() => toast.success('Saved successfully')}>Success</Button>
            <Button onClick={() => toast.error('Something went wrong')}>Error</Button>
            <Button onClick={() => toast.warning('Heads up')}>Warning</Button>
          </div>
        </Section>

        <Section title="Skeleton">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[260px]" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-24 w-full max-w-md rounded-xl" />
          </div>
        </Section>

        <Section title="Scroll area">
          <ScrollArea className="h-32 w-full max-w-md rounded-md border p-3">
            <div className="space-y-2 text-sm">
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i}>Line {i + 1} — scroll me</p>
              ))}
            </div>
          </ScrollArea>
        </Section>

        <Section title="Separator">
          <div className="max-w-md space-y-3 text-sm">
            <p>Above the separator.</p>
            <Separator />
            <p>Below the separator.</p>
          </div>
        </Section>

        <Section title="Wobble animation">
          <div className="flex items-center gap-3">
            <Sparkles className="animate-wobble size-6 text-primary" />
            <span className="text-muted-foreground text-sm">
              .animate-wobble (active tool-call indicator)
            </span>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
