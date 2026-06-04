import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEFAULT_WS_URL,
  WSClient,
  type WSConnectionState,
} from '@/api/ws-client';
import { useAuthStore } from '@/stores/auth-store';
import { useStreamingStore } from '@/stores/streaming-store';
import type { WsServerEvent } from '@/schemas/ws-events';
import type { Message, MessageListResponse } from '@/schemas/conversation';

type SessionSingleton = {
  client: WSClient;
  refCount: number;
  state: WSConnectionState;
  subscribers: Set<() => void>;
  pendingByConversationId: Map<string | null, { tempUserId: string }>;
  activeMessages: Map<string, { conversationId: string }>;
};

let singleton: SessionSingleton | null = null;
let authUnsubscribe: (() => void) | null = null;

function messagesQueryKey(conversationId: string) {
  return ['conversations', conversationId, 'messages'] as const;
}

function conversationsQueryKey(workspaceId: string) {
  return ['conversations', 'list', workspaceId] as const;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${r}`;
}

function notify(s: SessionSingleton): void {
  s.subscribers.forEach((cb) => cb());
}

function setState(s: SessionSingleton, next: WSConnectionState): void {
  if (s.state === next) return;
  const prev = s.state;
  s.state = next;
  notify(s);
  if (prev === 'reconnecting' && next === 'open') {
    toast.success('Reconnected');
  }
}

function teardownSingleton(): void {
  if (!singleton) return;
  singleton.client.close();
  singleton.subscribers.clear();
  singleton.pendingByConversationId.clear();
  singleton.activeMessages.clear();
  singleton = null;
  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }
}

function createSingleton(queryClient: ReturnType<typeof useQueryClient>): SessionSingleton {
  const s: SessionSingleton = {
    client: null as unknown as WSClient,
    refCount: 0,
    state: 'idle',
    subscribers: new Set(),
    pendingByConversationId: new Map(),
    activeMessages: new Map(),
  };

  s.client = new WSClient({
    url: DEFAULT_WS_URL,
    getAccessToken: () => useAuthStore.getState().accessToken,
    onStateChange: (next) => setState(s, next),
    onEvent: (evt) => handleEvent(s, queryClient, evt),
  });

  authUnsubscribe = useAuthStore.subscribe((cur, prev) => {
    if (prev.accessToken && !cur.accessToken) {
      teardownSingleton();
    }
  });

  return s;
}

function commitAssistantMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  messageId: string,
  content: string,
): void {
  queryClient.setQueryData<MessageListResponse>(
    messagesQueryKey(conversationId),
    (prev) => {
      const next: Message = {
        id: messageId,
        conversationId,
        role: 'assistant',
        content,
        createdAt: nowIso(),
      };
      if (!prev) return { messages: [next] };
      if (prev.messages.some((m) => m.id === messageId)) {
        return {
          messages: prev.messages.map((m) =>
            m.id === messageId ? { ...m, content } : m,
          ),
        };
      }
      return { messages: [...prev.messages, next] };
    },
  );
}

function handleEvent(
  s: SessionSingleton,
  queryClient: ReturnType<typeof useQueryClient>,
  evt: WsServerEvent,
): void {
  const streaming = useStreamingStore.getState();

  if (evt.type === 's.chat.started') {
    s.activeMessages.set(evt.messageId, { conversationId: evt.conversationId });
    streaming.start(evt.messageId, evt.conversationId);

    const pendingForNull = s.pendingByConversationId.get(null);
    if (pendingForNull) {
      const tempCache = queryClient.getQueryData<MessageListResponse>(
        messagesQueryKey('_pending'),
      );
      if (tempCache) {
        queryClient.setQueryData<MessageListResponse>(
          messagesQueryKey(evt.conversationId),
          {
            messages: tempCache.messages.map((m) => ({
              ...m,
              conversationId: evt.conversationId,
            })),
          },
        );
        queryClient.removeQueries({ queryKey: messagesQueryKey('_pending') });
      }
      s.pendingByConversationId.delete(null);
      s.pendingByConversationId.set(evt.conversationId, pendingForNull);
    }
    return;
  }

  if (evt.type === 's.chat.token') {
    streaming.appendDelta(evt.messageId, evt.delta);
    return;
  }

  if (evt.type === 's.chat.completed') {
    const entry = useStreamingStore.getState().entries[evt.messageId];
    const finalText = entry?.delta ?? '';
    commitAssistantMessage(queryClient, evt.conversationId, evt.messageId, finalText);
    streaming.setStatus(evt.messageId, 'completed');
    streaming.remove(evt.messageId);
    s.activeMessages.delete(evt.messageId);
    s.pendingByConversationId.delete(evt.conversationId);
    return;
  }

  if (evt.type === 's.chat.aborted') {
    const entry = useStreamingStore.getState().entries[evt.messageId];
    const finalText = entry?.delta ?? '';
    if (finalText.length > 0) {
      commitAssistantMessage(queryClient, evt.conversationId, evt.messageId, finalText);
    }
    streaming.setStatus(evt.messageId, 'aborted');
    streaming.remove(evt.messageId);
    s.activeMessages.delete(evt.messageId);
    s.pendingByConversationId.delete(evt.conversationId);
    return;
  }

  if (evt.type === 's.conversation.title_generated') {
    queryClient.setQueriesData<{ conversations: Array<{ id: string; title: string; workspaceId: string; createdAt: string; updatedAt: string }> }>(
      { queryKey: ['conversations', 'list'] },
      (prev) => {
        if (!prev) return prev;
        const existing = prev.conversations.find((c) => c.id === evt.conversationId);
        if (existing) {
          return {
            conversations: prev.conversations.map((c) =>
              c.id === evt.conversationId ? { ...c, title: evt.title } : c,
            ),
          };
        }
        return {
          conversations: [
            {
              id: evt.conversationId,
              workspaceId: prev.conversations[0]?.workspaceId ?? '',
              title: evt.title,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
            ...prev.conversations,
          ],
        };
      },
    );
    return;
  }

  if (evt.type === 's.error') {
    if (evt.messageId) {
      streaming.setStatus(evt.messageId, 'error');
      streaming.remove(evt.messageId);
      s.activeMessages.delete(evt.messageId);
    }
    toast.error(evt.message || 'Chat error');
  }
}

export type SendMessageInput = {
  text: string;
  conversationId: string | null;
  workspaceId: string;
};

export type SendMessageResult = {
  tempUserMessageId: string;
  conversationCacheKey: string;
};

export type ChatSession = {
  status: WSConnectionState;
  sendMessage: (input: SendMessageInput) => SendMessageResult;
  abort: (messageId: string, conversationId: string) => void;
};

export function useChatSession(): ChatSession {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((st) => st.accessToken);
  const sessionRef = useRef<SessionSingleton | null>(null);

  if (!singleton && accessToken) {
    singleton = createSingleton(queryClient);
  }
  sessionRef.current = singleton;

  useEffect(() => {
    if (!accessToken) return;
    if (!singleton) {
      singleton = createSingleton(queryClient);
    }
    const s = singleton;
    s.refCount += 1;
    if (s.state === 'idle' || s.state === 'closed') {
      s.client.connect();
    }
    return () => {
      s.refCount -= 1;
      if (s.refCount <= 0) {
        teardownSingleton();
      }
    };
  }, [accessToken, queryClient]);

  const subscribe = useCallback((cb: () => void) => {
    const s = singleton;
    if (!s) return () => {};
    s.subscribers.add(cb);
    return () => {
      s.subscribers.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback((): WSConnectionState => {
    return singleton?.state ?? 'idle';
  }, []);

  const status = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const sendMessage = useCallback(
    (input: SendMessageInput): SendMessageResult => {
      const s = singleton;
      if (!s) throw new Error('Chat session not initialized');

      const tempUserMessageId = randomId('tmp_user');
      const cacheKey = input.conversationId ?? '_pending';

      queryClient.setQueryData<MessageListResponse>(
        messagesQueryKey(cacheKey),
        (prev) => {
          const userMsg: Message = {
            id: tempUserMessageId,
            conversationId: input.conversationId ?? cacheKey,
            role: 'user',
            content: input.text,
            createdAt: nowIso(),
          };
          if (!prev) return { messages: [userMsg] };
          return { messages: [...prev.messages, userMsg] };
        },
      );

      s.pendingByConversationId.set(input.conversationId, { tempUserId: tempUserMessageId });

      s.client.send({
        type: 'c.chat.send',
        conversationId: input.conversationId,
        workspaceId: input.workspaceId,
        message: { role: 'user', content: input.text },
      });

      return { tempUserMessageId, conversationCacheKey: cacheKey };
    },
    [queryClient],
  );

  const abort = useCallback((messageId: string, conversationId: string) => {
    const s = singleton;
    if (!s) return;
    try {
      s.client.send({ type: 'c.chat.abort', messageId, conversationId });
    } catch {
      // socket closed; ignore
    }
  }, []);

  return { status, sendMessage, abort };
}

export const __testing = {
  teardownSingleton,
  messagesQueryKey,
  conversationsQueryKey,
};
