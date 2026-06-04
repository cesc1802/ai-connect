import { useStreamingEntry } from '@/stores/streaming-store';
import { MessageBubble } from './message-bubble';

type StreamingBubbleProps = {
  messageId: string;
};

export function StreamingBubble({ messageId }: StreamingBubbleProps) {
  const entry = useStreamingEntry(messageId);
  if (!entry) return null;
  const showCursor = entry.status === 'streaming';
  return (
    <MessageBubble role="assistant" content={entry.delta}>
      {showCursor && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block animate-pulse"
          data-testid="streaming-cursor"
        >
          ▍
        </span>
      )}
    </MessageBubble>
  );
}
