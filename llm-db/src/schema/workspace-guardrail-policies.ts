import { pgTable, uuid, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces.js";
import { auditColumns } from "./_audit-columns.js";

/**
 * One guardrail policy per workspace. Absence of a row means guardrails are
 * disabled (safe passthrough). `checks` is a JSONB array of per-check config
 * (kind/enabled/action/options) — keeping it JSONB lets check options evolve
 * without schema churn; the shape is validated by the shared zod schema before
 * write.
 */
export const workspaceGuardrailPolicies = pgTable(
  "workspace_guardrail_policies",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    checks: jsonb("checks").notNull().default(sql`'[]'::jsonb`),
    ...auditColumns,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId] }),
  })
);

export type WorkspaceGuardrailPolicy = typeof workspaceGuardrailPolicies.$inferSelect;
export type NewWorkspaceGuardrailPolicy = typeof workspaceGuardrailPolicies.$inferInsert;
