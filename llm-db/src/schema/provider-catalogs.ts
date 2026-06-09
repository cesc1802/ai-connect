import { pgTable, uuid, text, jsonb } from "drizzle-orm/pg-core";
import { auditColumns } from "./_audit-columns.js";

export const providerCatalogs = pgTable("provider_catalogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  host: text("host").notNull(),
  models: jsonb("models").$type<string[]>().notNull().default([]),
  ...auditColumns,
});

export type ProviderCatalog = typeof providerCatalogs.$inferSelect;
export type NewProviderCatalog = typeof providerCatalogs.$inferInsert;
