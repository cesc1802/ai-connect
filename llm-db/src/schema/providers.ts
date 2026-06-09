import { pgTable, uuid, text, boolean, unique, index } from "drizzle-orm/pg-core";
import { providerCatalogs } from "./provider-catalogs.js";
import { auditColumns } from "./_audit-columns.js";

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => providerCatalogs.id, { onDelete: "restrict" }),
    alias: text("alias").notNull(),
    baseUrl: text("base_url"),
    apiKeyRef: text("api_key_ref"),
    enabled: boolean("enabled").notNull().default(true),
    ...auditColumns,
  },
  (t) => ({
    catalogAliasUnique: unique("providers_catalog_alias_unique").on(
      t.catalogId,
      t.alias
    ),
    byCatalog: index("providers_catalog_idx").on(t.catalogId),
  })
);

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
