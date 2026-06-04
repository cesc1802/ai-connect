import * as React from 'react';

import {
  DataTable,
  type DataTableColumn,
  type DataTableState,
} from '@/components/admin/data-table';
import { useWsRoles } from '@/hooks/use-ws-roles';
import type { WsRoleCatalogueEntry } from '@/schemas/admin';
import type { WorkspaceRole } from '@/schemas/auth';

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export function RolesTab() {
  const { data, isLoading, isError, refetch } = useWsRoles();
  const rows = React.useMemo(() => data ?? [], [data]);

  const state: DataTableState = isError
    ? 'error'
    : isLoading
      ? 'loading'
      : rows.length === 0
        ? 'empty'
        : 'ready';

  const columns: DataTableColumn<WsRoleCatalogueEntry>[] = React.useMemo(
    () => [
      {
        key: 'role',
        header: 'Role',
        cell: (row) => (
          <span className="font-medium">{ROLE_LABEL[row.role]}</span>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        cell: (row) => row.description,
      },
    ],
    [],
  );

  return (
    <section
      data-slot="roles-tab"
      className="flex flex-col gap-4"
      aria-labelledby="roles-tab-heading"
    >
      <header>
        <h2 id="roles-tab-heading" className="text-base font-semibold">
          Workspace roles
        </h2>
        <p className="text-muted-foreground text-sm">
          Roles are predefined and cannot be edited.
        </p>
      </header>

      <DataTable
        caption="Workspace roles"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.role}
        state={state}
        emptyHeading="No roles configured"
        emptyBody="Roles will appear here once the catalogue is available."
        errorMessage="Could not load roles."
        onRetry={() => {
          void refetch();
        }}
      />
    </section>
  );
}

export default RolesTab;
