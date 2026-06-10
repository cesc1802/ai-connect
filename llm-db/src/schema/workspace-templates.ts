import { pgTable, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { promptTemplates } from "./prompt-templates.js";
import { auditColumns } from "./_audit-columns.js";

export const workspaceTemplates = pgTable(
  "workspace_templates",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => promptTemplates.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.templateId] }),
    byTemplate: index("workspace_templates_template_idx").on(t.templateId),
  })
);

export type WorkspaceTemplate = typeof workspaceTemplates.$inferSelect;
export type NewWorkspaceTemplate = typeof workspaceTemplates.$inferInsert;
