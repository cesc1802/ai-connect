import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLogout } from '@/hooks/use-logout';

/**
 * Landing surface for two cases:
 *  - UC-036 A2: user signed in but has no workspace memberships.
 *  - UC-030 A1: returning to workspace context but no valid last-used workspace
 *    and no memberships left (all revoked).
 *
 * The only action available is Sign Out so a stranded user can leave.
 */
export function NoWorkspaceGuardPage() {
  const logoutMutation = useLogout();

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader className="items-start gap-2">
          <ShieldAlert className="text-destructive size-6" />
          <CardTitle className="text-xl">No workspace available</CardTitle>
          <CardDescription>
            You're not a member of any workspace yet. Contact your organization
            admin to be invited.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          You can sign out and try again with a different account.
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
