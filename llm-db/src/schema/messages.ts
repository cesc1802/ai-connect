import { pgTable, uuid, text, index } from "drizzle-orm/pg-core";
import { conversations } from "./conversations.js";
import { auditColumns } from "./_audit-columns.js";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    ...auditColumns,
  },
  (t) => ({
    byConversationCreated: index("messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt
    ),
  })
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
