import { pgTable, uuid, text, primaryKey, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";
import { auditColumns } from "./_audit-columns.js";

export const userRoleWorkspaces = pgTable(
  "user_role_workspaces",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    ...auditColumns,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.workspaceId, t.role] }),
    byWorkspaceRole: index("user_role_workspaces_workspace_role_idx").on(
      t.workspaceId,
      t.role
    ),
  })
);

export type UserRoleWorkspace = typeof userRoleWorkspaces.$inferSelect;
export type NewUserRoleWorkspace = typeof userRoleWorkspaces.$inferInsert;
