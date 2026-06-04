import { useQuery } from '@tanstack/react-query';
import { getMessages, listConversations } from '@/api/conversations';
import type {
  ConversationListResponse,
  MessageListResponse,
} from '@/schemas/conversation';

export function conversationListQueryKey(workspaceId: string) {
  return ['conversations', 'list', workspaceId] as const;
}

export function messagesQueryKey(conversationId: string) {
  return ['conversations', conversationId, 'messages'] as const;
}

export function useConversations(workspaceId: string | null) {
  return useQuery<ConversationListResponse>({
    queryKey: conversationListQueryKey(workspaceId ?? ''),
    queryFn: () => listConversations(workspaceId!),
    enabled: workspaceId != null,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery<MessageListResponse>({
    queryKey: messagesQueryKey(conversationId ?? ''),
    queryFn: () => getMessages(conversationId!),
    enabled: conversationId != null && conversationId !== '_pending',
  });
}
