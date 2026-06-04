import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useStreamingStore } from '@/stores/streaming-store';
import { DEMO_ACCESS_TOKEN, DEMO_EXPIRES_IN_SEC, DEMO_USER } from '@/mocks/fixtures/users';
import type { MessageListResponse } from '@/schemas/conversation';

const sendSpy = vi.fn();
const connectSpy = vi.fn();
const closeSpy = vi.fn();
let capturedOnEvent: ((evt: unknown) => void) | null = null;
let capturedOnStateChange: ((state: unknown) => void) | null = null;

vi.mock('@/api/ws-client', () => {
  class FakeWSClient {
    constructor(opts: { onEvent: (evt: unknown) => void; onStateChange?: (s: unknown) => void }) {
      capturedOnEvent = opts.onEvent;
      capturedOnStateChange = opts.onStateChange ?? null;
    }
    connect() {
      connectSpy();
      capturedOnStateChange?.('connecting');
      capturedOnStateChange?.('open');
    }
    send(cmd: unknown) {
      sendSpy(cmd);
    }
    close() {
      closeSpy();
      capturedOnStateChange?.('closed');
    }
    getState() {
      return 'open';
    }
  }
  return {
    WSClient: FakeWSClient,
    DEFAULT_WS_URL: 'ws://localhost/ws/chat/v2',
  };
});

import { useChatSession, __testing } from '@/hooks/use-chat-session';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}

describe('useChatSession', () => {
  beforeEach(() => {
    sendSpy.mockReset();
    connectSpy.mockReset();
    closeSpy.mockReset();
    capturedOnEvent = null;
    capturedOnStateChange = null;
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });

  afterEach(() => {
    __testing.teardownSingleton();
    useStreamingStore.getState().clear();
    useAuthStore.getState().clear();
  });

  it('writes the optimistic user message to the query cache BEFORE calling ws.send', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const cacheWriteOrder: string[] = [];
    const origSetQueryData = queryClient.setQueryData.bind(queryClient);
    vi.spyOn(queryClient, 'setQueryData').mockImplementation(
      ((key: unknown, ...rest: unknown[]) => {
        cacheWriteOrder.push('setQueryData');
        return (origSetQueryData as (...a: unknown[]) => unknown)(key, ...rest);
      }) as typeof queryClient.setQueryData,
    );
    sendSpy.mockImplementation(() => {
      cacheWriteOrder.push('ws.send');
    });

    const { result } = renderHook(() => useChatSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('open'));

    act(() => {
      result.current.sendMessage({
        text: 'Hello there',
        conversationId: null,
        workspaceId: 'wsp_personal',
      });
    });

    expect(cacheWriteOrder[0]).toBe('setQueryData');
    expect(cacheWriteOrder).toContain('ws.send');
    expect(cacheWriteOrder.indexOf('setQueryData')).toBeLessThan(
      cacheWriteOrder.indexOf('ws.send'),
    );

    const pending = queryClient.getQueryData<MessageListResponse>([
      'conversations',
      '_pending',
      'messages',
    ]);
    expect(pending?.messages[0]?.role).toBe('user');
    expect(pending?.messages[0]?.content).toBe('Hello there');
  });

  it('on s.chat.started, creates a streaming entry and rekeys pending messages to the new conversation id', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useChatSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('open'));

    act(() => {
      result.current.sendMessage({
        text: 'Hi',
        conversationId: null,
        workspaceId: 'wsp_personal',
      });
    });

    act(() => {
      capturedOnEvent?.({
        type: 's.chat.started',
        conversationId: 'cnv_new',
        messageId: 'msg_a',
      });
    });

    const entry = useStreamingStore.getState().entries['msg_a'];
    expect(entry).toBeDefined();
    expect(entry?.conversationId).toBe('cnv_new');

    const moved = queryClient.getQueryData<MessageListResponse>([
      'conversations',
      'cnv_new',
      'messages',
    ]);
    expect(moved?.messages[0]?.content).toBe('Hi');
    const pendingGone = queryClient.getQueryData([
      'conversations',
      '_pending',
      'messages',
    ]);
    expect(pendingGone).toBeUndefined();
  });

  it('on s.chat.completed, commits final assistant message and removes streaming entry', async () => {
    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useChatSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('open'));

    act(() => {
      result.current.sendMessage({
        text: 'Hello',
        conversationId: 'cnv_x',
        workspaceId: 'wsp_personal',
      });
    });
    act(() => {
      capturedOnEvent?.({ type: 's.chat.started', conversationId: 'cnv_x', messageId: 'msg_b' });
      capturedOnEvent?.({ type: 's.chat.token', conversationId: 'cnv_x', messageId: 'msg_b', delta: 'Hi ' });
      capturedOnEvent?.({ type: 's.chat.token', conversationId: 'cnv_x', messageId: 'msg_b', delta: 'there' });
      capturedOnEvent?.({
        type: 's.chat.completed',
        conversationId: 'cnv_x',
        messageId: 'msg_b',
        finishReason: 'stop',
      });
    });

    expect(useStreamingStore.getState().entries['msg_b']).toBeUndefined();
    const cache = queryClient.getQueryData<MessageListResponse>([
      'conversations',
      'cnv_x',
      'messages',
    ]);
    const assistant = cache?.messages.find((m) => m.id === 'msg_b');
    expect(assistant?.content).toBe('Hi there');
    expect(assistant?.role).toBe('assistant');
  });
});
