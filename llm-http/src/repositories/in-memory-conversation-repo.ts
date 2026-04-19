import { randomUUID } from "node:crypto";
import type {
  Conversation,
  ConversationRepository,
} from "@ai-connect/shared";

export class InMemoryConversationRepository implements ConversationRepository {
  private byId = new Map<string, Conversation>();
  private byUser = new Map<string, Set<string>>();

  async create(
    input: Omit<Conversation, "id">
  ): Promise<Conversation> {
    const conv: Conversation = {
      id: randomUUID(),
      ...input,
    };
    this.byId.set(conv.id, conv);
    const userSet = this.byUser.get(conv.userId) ?? new Set();
    userSet.add(conv.id);
    this.byUser.set(conv.userId, userSet);
    return conv;
  }

  async get(id: string): Promise<Conversation | undefined> {
    return this.byId.get(id);
  }

  async listByUser(userId: string): Promise<Conversation[]> {
    const ids = this.byUser.get(userId) ?? new Set();
    return [...ids]
      .map((id) => this.byId.get(id)!)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateTitle(
    id: string,
    title: string
  ): Promise<Conversation | undefined> {
    const conv = this.byId.get(id);
    if (!conv) return undefined;
    conv.title = title;
    conv.updatedAt = Date.now();
    return conv;
  }
}
