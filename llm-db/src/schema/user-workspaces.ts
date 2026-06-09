import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";
import { auditColumns } from "./_audit-columns.js";

export const userWorkspaces = pgTable(
  "user_workspaces",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ...auditColumns,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.workspaceId] }),
  })
);

export type UserWorkspace = typeof userWorkspaces.$inferSelect;
export type NewUserWorkspace = typeof userWorkspaces.$inferInsert;
