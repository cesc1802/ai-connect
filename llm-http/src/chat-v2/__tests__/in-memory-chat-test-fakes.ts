import { randomUUID } from "node:crypto";
import type {
  Conversation,
  ConversationRepository,
  Message,
  MessageRepository,
} from "@ai-connect/shared";
import type {
  ActiveWorkspace,
  ActiveWorkspaceResolver,
} from "../../workspace/active-workspace-resolver.js";
import {
  DEV_WORKSPACE_ID,
  DEV_WORKSPACE_SLUG,
  DEV_WORKSPACE_NAME,
} from "../../auth/dev-seed-constants.js";

/** Test fake: map-backed ConversationRepository. */
export class InMemoryConversationRepository implements ConversationRepository {
  private byId = new Map<string, Conversation>();
  private byUser = new Map<string, Set<string>>();

  async create(input: Omit<Conversation, "id">): Promise<Conversation> {
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

  async updateTitle(id: string, title: string): Promise<Conversation | undefined> {
    const conv = this.byId.get(id);
    if (!conv) return undefined;
    conv.title = title;
    conv.updatedAt = Date.now();
    return conv;
  }

  async touch(id: string): Promise<void> {
    const conv = this.byId.get(id);
    if (conv) conv.updatedAt = Date.now();
  }
}

/** Test fake: map-backed MessageRepository that bumps conversation timestamps. */
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

/** Test fake: always resolves to the seeded dev workspace. */
export class InMemoryActiveWorkspaceResolver implements ActiveWorkspaceResolver {
  async getForUser(_userId: string): Promise<ActiveWorkspace | null> {
    return {
      id: DEV_WORKSPACE_ID,
      slug: DEV_WORKSPACE_SLUG,
      name: DEV_WORKSPACE_NAME,
    };
  }
}
