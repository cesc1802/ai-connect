import { MoreHorizontal, SquarePen, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AssignmentRowActionsProps {
  workspaceName: string;
  onChangeRole: () => void;
  onRemove: () => void;
}

export function AssignmentRowActions({
  workspaceName,
  onChangeRole,
  onRemove,
}: AssignmentRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Tác vụ cho ${workspaceName}`}
          className="text-muted-foreground h-8 w-8"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onChangeRole}>
          <SquarePen className="h-4 w-4" aria-hidden="true" />
          Đổi vai trò
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRemove} variant="destructive">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Gỡ khỏi workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
