import { api } from "./api";

// Thin typed wrappers over the llm-http /conversations endpoints. Both are
// owner-scoped server-side; the JWT identifies the caller.

export interface ConversationSummary {
  id: string;
  workspaceId: string;
  title: string;
  templateId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface WireMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: number;
}

export function listMyConversations(): Promise<ConversationSummary[]> {
  return api
    .get<{ conversations: ConversationSummary[] }>("/conversations")
    .then((r) => r.conversations);
}

export function getConversationMessages(id: string): Promise<WireMessage[]> {
  return api
    .get<{ messages: WireMessage[] }>(
      `/conversations/${encodeURIComponent(id)}/messages`
    )
    .then((r) => r.messages);
}
