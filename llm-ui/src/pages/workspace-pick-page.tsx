import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceCard } from '@/components/auth/workspace-card';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import type { Workspace } from '@/schemas/workspace';

export function WorkspacePickPage() {
  const navigate = useNavigate();
  const setActiveWorkspace = useActiveWorkspaceStore((s) => s.setActiveWorkspace);
  const { data, isPending, isError, refetch, isFetching } = useWorkspaces();

  const workspaces = data?.workspaces ?? [];
  const onlyOne = workspaces.length === 1 ? workspaces[0] : null;

  // Auto-select singleton workspace and route to /chat.
  useEffect(() => {
    if (!onlyOne) return;
    setActiveWorkspace(onlyOne.id, onlyOne.role);
    void navigate({ to: '/chat' });
  }, [onlyOne, setActiveWorkspace, navigate]);

  const handleSelect = (workspace: Workspace) => {
    setActiveWorkspace(workspace.id, workspace.role);
    void navigate({ to: '/chat' });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Choose a workspace</CardTitle>
          <CardDescription>Pick which workspace you'd like to enter.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <WorkspaceSkeletonGrid />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
          ) : onlyOne ? (
            // Brief splash while the auto-redirect effect runs.
            <p className="text-muted-foreground py-6 text-center text-sm">
              Opening {onlyOne.name}…
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {workspaces.map((ws) => (
                <WorkspaceCard key={ws.id} workspace={ws} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  );
}

function ErrorState({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <AlertTriangle className="text-destructive size-6" />
      <p className="text-sm">Could not load your workspaces.</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Try again'}
      </Button>
    </div>
  );
}
