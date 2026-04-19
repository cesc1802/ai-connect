export interface Conversation {
  id: string;
  userId: string;
  title?: string;
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
}

export interface MessageRepository {
  append(message: Omit<Message, "id">): Promise<Message>;
  listByConversation(conversationId: string): Promise<Message[]>;
}
