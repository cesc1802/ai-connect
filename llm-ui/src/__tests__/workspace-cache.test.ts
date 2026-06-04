import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { resetWorkspaceScopedCaches } from '@/lib/workspace-cache';
import { useStreamingStore } from '@/stores/streaming-store';

describe('resetWorkspaceScopedCaches', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
    qc.setQueryData(['conversations', 'list', 'wsp_a'], { conversations: [] });
    qc.setQueryData(['conversations', 'cv_1', 'messages'], { messages: [] });
    qc.setQueryData(['admin', 'workspace', 'templates'], { etag: 'x', data: {} });
    qc.setQueryData(['workspaces', 'wsp_a', 'resources'], { providers: [] });
    qc.setQueryData(['unrelated'], { keep: true });
    useStreamingStore.getState().start('msg_1', 'cv_1');
  });

  afterEach(() => {
    qc.clear();
    useStreamingStore.getState().clear();
  });

  it('removes conversation, template, and resource queries', () => {
    resetWorkspaceScopedCaches(qc);
    expect(qc.getQueryData(['conversations', 'list', 'wsp_a'])).toBeUndefined();
    expect(qc.getQueryData(['conversations', 'cv_1', 'messages'])).toBeUndefined();
    expect(qc.getQueryData(['admin', 'workspace', 'templates'])).toBeUndefined();
    expect(qc.getQueryData(['workspaces', 'wsp_a', 'resources'])).toBeUndefined();
  });

  it('leaves unrelated cache entries intact', () => {
    resetWorkspaceScopedCaches(qc);
    expect(qc.getQueryData(['unrelated'])).toEqual({ keep: true });
  });

  it('clears streaming store', () => {
    resetWorkspaceScopedCaches(qc);
    expect(useStreamingStore.getState().entries).toEqual({});
  });
});
