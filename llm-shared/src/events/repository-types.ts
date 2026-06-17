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

/** One usage row to persist for a completed chat turn. */
export interface NewUsageRecord {
  workspaceId: string;
  userId: string;
  providerId?: string | null;
  conversationId?: string | null;
  providerKind: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

/** Token totals grouped by the provider that served the turns. */
export interface ProviderUsage {
  providerId: string | null;
  providerKind: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
}

/** Token totals grouped by workspace. */
export interface WorkspaceUsage {
  workspaceId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
}

/**
 * Scope for usage aggregation: "all" for org-wide (admin), or an explicit list
 * of workspace ids (member — limited to their workspaces).
 */
export type UsageScope = "all" | string[];

export interface UsageRepository {
  record(input: NewUsageRecord): Promise<void>;
  aggregateByProvider(scope: UsageScope): Promise<ProviderUsage[]>;
  aggregateByWorkspace(scope: UsageScope): Promise<WorkspaceUsage[]>;
}
