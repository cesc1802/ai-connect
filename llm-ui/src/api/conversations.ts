import { apiFetch } from './client';
import {
  ConversationListResponse,
  MessageListResponse,
} from '@/schemas/conversation';

export async function listConversations(
  workspaceId: string,
): Promise<ConversationListResponse> {
  const qs = new URLSearchParams({ workspaceId }).toString();
  return apiFetch(`/conversations?${qs}`, { method: 'GET' }, ConversationListResponse);
}

export async function getMessages(
  conversationId: string,
): Promise<MessageListResponse> {
  return apiFetch(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: 'GET' },
    MessageListResponse,
  );
}
