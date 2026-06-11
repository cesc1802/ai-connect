import { pgTable, uuid, text, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";
import { promptTemplates } from "./prompt-templates.js";
import { auditColumns } from "./_audit-columns.js";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Prompt template the conversation was seeded from; null for legacy rows. */
    templateId: uuid("template_id").references(() => promptTemplates.id, {
      onDelete: "set null",
    }),
    ...auditColumns,
  },
  (t) => ({
    byWorkspaceUpdated: index("conversations_workspace_updated_idx").on(
      t.workspaceId,
      t.updatedAt
    ),
    byUserUpdated: index("conversations_user_updated_idx").on(
      t.userId,
      t.updatedAt
    ),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
