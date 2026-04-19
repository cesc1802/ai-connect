import { randomUUID } from "node:crypto";
import type {
  Message,
  MessageRepository,
  ConversationRepository,
} from "@ai-connect/shared";

export class InMemoryMessageRepository implements MessageRepository {
  private byConv = new Map<string, Message[]>();

  constructor(private readonly conversationRepo: ConversationRepository) {}

  async append(input: Omit<Message, "id">): Promise<Message> {
    const msg: Message = {
      id: randomUUID(),
      ...input,
    };
    const arr = this.byConv.get(input.conversationId) ?? [];
    arr.push(msg);
    this.byConv.set(input.conversationId, arr);

    const conv = await this.conversationRepo.get(input.conversationId);
    if (conv) conv.updatedAt = msg.createdAt;

    return msg;
  }

  async listByConversation(conversationId: string): Promise<Message[]> {
    return [...(this.byConv.get(conversationId) ?? [])];
  }
}
