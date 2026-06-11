import type { Message as MessageRow } from "@ai-connect/db";
import type { Message } from "@ai-connect/shared";

export function toDomain(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Message["role"],
    content: row.content,
    createdAt: row.createdAt.getTime(),
  };
}
