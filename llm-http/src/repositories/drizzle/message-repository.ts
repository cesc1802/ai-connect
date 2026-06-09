import { eq, asc } from "drizzle-orm";
import { messages, conversations, type DbClient } from "@ai-connect/db";
import type { Message, MessageRepository } from "@ai-connect/shared";
import { toDomain } from "./message-mapper.js";

export class DrizzleMessageRepository implements MessageRepository {
  constructor(private readonly client: DbClient) {}

  async append(input: Omit<Message, "id">): Promise<Message> {
    return this.client.db.transaction(async (tx) => {
      const createdAt = new Date(input.createdAt);
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      await tx
        .update(conversations)
        .set({ updatedAt: createdAt })
        .where(eq(conversations.id, input.conversationId));
      return toDomain(row!);
    });
  }

  async listByConversation(conversationId: string): Promise<Message[]> {
    const rows = await this.client.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
    return rows.map(toDomain);
  }
}
