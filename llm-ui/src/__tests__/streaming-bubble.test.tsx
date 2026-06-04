import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { StreamingBubble } from '@/components/chat/streaming-bubble';
import { useStreamingStore } from '@/stores/streaming-store';

describe('StreamingBubble', () => {
  afterEach(() => {
    useStreamingStore.getState().clear();
  });

  it('appends incremental deltas and shows the streaming cursor', () => {
    const messageId = 'msg_001';
    act(() => {
      useStreamingStore.getState().start(messageId, 'cnv_001');
    });
    render(<StreamingBubble messageId={messageId} />);

    act(() => {
      useStreamingStore.getState().appendDelta(messageId, 'Hello');
    });
    act(() => {
      useStreamingStore.getState().appendDelta(messageId, ', world');
    });

    expect(screen.getByText(/Hello, world/)).toBeInTheDocument();
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();
  });

  it('hides the streaming cursor once status changes to completed', () => {
    const messageId = 'msg_002';
    act(() => {
      useStreamingStore.getState().start(messageId, 'cnv_001');
      useStreamingStore.getState().appendDelta(messageId, 'done');
    });
    render(<StreamingBubble messageId={messageId} />);
    expect(screen.getByTestId('streaming-cursor')).toBeInTheDocument();

    act(() => {
      useStreamingStore.getState().setStatus(messageId, 'completed');
    });
    expect(screen.queryByTestId('streaming-cursor')).toBeNull();
  });

  it('renders nothing if entry has been removed', () => {
    const { container } = render(<StreamingBubble messageId="missing" />);
    expect(container).toBeEmptyDOMElement();
  });
});
