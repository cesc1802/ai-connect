export interface Conversation {
  id: string;
  workspaceId: string;
  userId: string;
  title?: string;
  /** Prompt template the conversation was seeded from; absent for legacy rows. */
  templateId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  partial?: boolean;
  createdAt: number;
}

export interface ConversationRepository {
  create(conversation: Omit<Conversation, "id">): Promise<Conversation>;
  get(id: string): Promise<Conversation | undefined>;
  listByUser(userId: string): Promise<Conversation[]>;
  updateTitle(id: string, title: string): Promise<Conversation | undefined>;
  /** Bump updatedAt so the conversation sorts to the top of recency lists. */
  touch(id: string): Promise<void>;
}

export interface MessageRepository {
  append(message: Omit<Message, "id">): Promise<Message>;
  listByConversation(conversationId: string): Promise<Message[]>;
}
