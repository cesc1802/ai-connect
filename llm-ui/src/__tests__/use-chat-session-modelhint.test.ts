import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth-store';
import { useChatModelStore } from '@/stores/chat-model-store';
import { useStreamingStore } from '@/stores/streaming-store';
import { DEMO_ACCESS_TOKEN, DEMO_EXPIRES_IN_SEC, DEMO_USER } from '@/mocks/fixtures/users';

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
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, queryClient };
}

describe('useChatSession modelHint wiring', () => {
  beforeEach(() => {
    sendSpy.mockReset();
    connectSpy.mockReset();
    closeSpy.mockReset();
    capturedOnEvent = null;
    capturedOnStateChange = null;
    useChatModelStore.getState().clearAll();
    useAuthStore.getState().setSession({
      accessToken: DEMO_ACCESS_TOKEN,
      user: DEMO_USER,
      expiresInSec: DEMO_EXPIRES_IN_SEC,
    });
  });

  afterEach(() => {
    __testing.teardownSingleton();
    useStreamingStore.getState().clear();
    useChatModelStore.getState().clearAll();
    useAuthStore.getState().clear();
  });

  it('outbound c.chat.send carries modelHint when a selection exists for the workspace', async () => {
    const { Wrapper } = makeWrapper();
    useChatModelStore.getState().setModel('wsp_personal', {
      providerId: 'prv_openai',
      modelId: 'gpt-4o',
    });

    const { result } = renderHook(() => useChatSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('open'));

    act(() => {
      result.current.sendMessage({
        text: 'Hi',
        conversationId: null,
        workspaceId: 'wsp_personal',
      });
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const frame = sendSpy.mock.calls[0][0] as { type: string; modelHint?: string };
    expect(frame.type).toBe('c.chat.send');
    expect(frame.modelHint).toBe('prv_openai/gpt-4o');
  });

  it('omits modelHint when the store has no selection for the workspace', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useChatSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('open'));

    act(() => {
      result.current.sendMessage({
        text: 'Hello',
        conversationId: null,
        workspaceId: 'wsp_personal',
      });
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const frame = sendSpy.mock.calls[0][0] as { type: string; modelHint?: string };
    expect(frame.type).toBe('c.chat.send');
    expect('modelHint' in frame).toBe(false);
  });

  it('BR-085: changing the model mid-stream does NOT emit c.chat.abort', async () => {
    const { Wrapper } = makeWrapper();
    useChatModelStore.getState().setModel('wsp_personal', {
      providerId: 'prv_a',
      modelId: 'm1',
    });

    const { result } = renderHook(() => useChatSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('open'));

    act(() => {
      result.current.sendMessage({
        text: 'streaming...',
        conversationId: 'cnv_x',
        workspaceId: 'wsp_personal',
      });
    });

    // Begin a streaming reply
    act(() => {
      capturedOnEvent?.({ type: 's.chat.started', conversationId: 'cnv_x', messageId: 'msg_1' });
      capturedOnEvent?.({
        type: 's.chat.token',
        conversationId: 'cnv_x',
        messageId: 'msg_1',
        delta: 'partial',
      });
    });

    // User flips the model mid-stream
    act(() => {
      useChatModelStore.getState().setModel('wsp_personal', {
        providerId: 'prv_b',
        modelId: 'm2',
      });
    });

    // Stream completes normally
    act(() => {
      capturedOnEvent?.({
        type: 's.chat.completed',
        conversationId: 'cnv_x',
        messageId: 'msg_1',
        finishReason: 'stop',
      });
    });

    const aborts = sendSpy.mock.calls.filter(
      (c) => (c[0] as { type: string }).type === 'c.chat.abort',
    );
    expect(aborts).toHaveLength(0);

    // And the streaming entry was committed (i.e., not left dangling)
    expect(useStreamingStore.getState().entries['msg_1']).toBeUndefined();
  });
});
