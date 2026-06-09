import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { auditColumns } from "./_audit-columns.js";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ...auditColumns,
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
