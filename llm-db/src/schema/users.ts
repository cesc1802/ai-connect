import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { auditColumns } from "./_audit-columns.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // System role gates org-admin access; values ("admin"|"member") enforced in the app layer.
  role: text("role").notNull().default("member"),
  ...auditColumns,
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
