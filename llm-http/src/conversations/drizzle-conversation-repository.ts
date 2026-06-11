import { eq, desc } from "drizzle-orm";
import { conversations, type DbClient } from "@ai-connect/db";
import type {
  Conversation,
  ConversationRepository,
} from "@ai-connect/shared";
import { toDomain } from "./conversation-mapper.js";

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly client: DbClient) {}

  async create(input: Omit<Conversation, "id">): Promise<Conversation> {
    // title is NOT NULL in the schema; the domain treats "" as "no title yet".
    const [row] = await this.client.db
      .insert(conversations)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        title: input.title ?? "",
        templateId: input.templateId ?? null,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      })
      .returning();
    return toDomain(row!);
  }

  async get(id: string): Promise<Conversation | undefined> {
    const [row] = await this.client.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return row ? toDomain(row) : undefined;
  }

  async listByUser(userId: string): Promise<Conversation[]> {
    const rows = await this.client.db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
    return rows.map(toDomain);
  }

  async updateTitle(
    id: string,
    title: string
  ): Promise<Conversation | undefined> {
    const [row] = await this.client.db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return row ? toDomain(row) : undefined;
  }

  async touch(id: string): Promise<void> {
    await this.client.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, id));
  }
}
