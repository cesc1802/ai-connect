import { pgTable, uuid, text, integer } from "drizzle-orm/pg-core";
import { auditColumns } from "./_audit-columns.js";

export const promptTemplates = pgTable("prompt_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stable seed key — never changes once seeded. */
  slug: text("slug").notNull().unique(),
  title: text("title"),
  category: text("category"),
  icon: text("icon"),
  authorName: text("author_name"),
  uses: integer("uses").notNull().default(0),
  description: text("description"),
  ...auditColumns,
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type NewPromptTemplate = typeof promptTemplates.$inferInsert;
