import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Placeholder destination for the "+ New Workspace" entry. The full workspace
 * creation flow (UC-009) is out of scope for this plan; this page exists so
 * the sidebar link resolves to a real route instead of a 404.
 */
export function WorkspacesNewPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">New workspace</CardTitle>
          <CardDescription>
            Workspace creation isn't available yet. It will land in a follow-up
            release.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          For now, ask your organization admin to create a workspace for you.
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={() => void navigate({ to: '/workspaces/pick' })}>
            Back to picker
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
