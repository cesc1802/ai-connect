import * as React from 'react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/rbac/role-badge';
import type { Workspace } from '@/schemas/workspace';

// Route-tree registration for /workspaces/$workspaceId is owned by team-lead
// post-merge; cast Link until typegen learns the new route.
const TypedLink = Link as unknown as React.ComponentType<{
  to: string;
  params?: Record<string, string>;
  children?: React.ReactNode;
}>;

interface WorkspaceCardProps {
  workspace: Workspace;
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  return (
    <Card
      data-slot="workspace-card"
      data-workspace-id={workspace.id}
      className="gap-4"
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-3 text-base">
          <span className="truncate">{workspace.name}</span>
          <RoleBadge role={workspace.role} />
        </CardTitle>
        <p
          data-slot="workspace-card-slug"
          className="text-muted-foreground truncate font-mono text-xs"
        >
          {workspace.slug}
        </p>
      </CardHeader>
      <CardContent className="flex items-center justify-end">
        {/* TODO: add memberCount/providerCount to WorkspaceListResponse */}
        <Button asChild size="sm">
          <TypedLink
            to="/workspaces/$workspaceId"
            params={{ workspaceId: workspace.id }}
          >
            Mở
          </TypedLink>
        </Button>
      </CardContent>
    </Card>
  );
}
