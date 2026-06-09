import { pgTable, uuid, text, boolean, primaryKey, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";
import { providers } from "./providers.js";
import { auditColumns } from "./_audit-columns.js";

export const workspaceProviders = pgTable(
  "workspace_providers",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    aliasOverride: text("alias_override"),
    enabled: boolean("enabled").notNull().default(true),
    ...auditColumns,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.providerId] }),
    byProvider: index("workspace_providers_provider_idx").on(t.providerId),
  })
);

export type WorkspaceProvider = typeof workspaceProviders.$inferSelect;
export type NewWorkspaceProvider = typeof workspaceProviders.$inferInsert;
