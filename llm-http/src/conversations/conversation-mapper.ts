import type { Conversation as ConversationRow } from "@ai-connect/db";
import type { Conversation as DomainConversation } from "@ai-connect/shared";

export function toDomain(row: ConversationRow): DomainConversation {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    // title is notNull in the DB (stored as "" when absent); surface empty as undefined.
    ...(row.title ? { title: row.title } : {}),
    ...(row.templateId ? { templateId: row.templateId } : {}),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}
