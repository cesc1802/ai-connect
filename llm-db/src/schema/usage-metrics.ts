import { pgTable, uuid, text, integer, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";
import { providers } from "./providers.js";
import { conversations } from "./conversations.js";
import { auditColumns } from "./_audit-columns.js";

export const usageMetrics = pgTable(
  "usage_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    providerKind: text("provider_kind").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    ...auditColumns,
  },
  (t) => ({
    byWorkspaceCreated: index("usage_metrics_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt
    ),
    byUserCreated: index("usage_metrics_user_created_idx").on(
      t.userId,
      t.createdAt
    ),
    byProviderCreated: index("usage_metrics_provider_created_idx").on(
      t.providerId,
      t.createdAt
    ),
  })
);

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type NewUsageMetric = typeof usageMetrics.$inferInsert;
