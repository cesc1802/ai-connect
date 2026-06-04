import { useEffect, useLayoutEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMessages } from '@/hooks/use-conversations';
import { useStreamingMessageIdsFor, useStreamingStore } from '@/stores/streaming-store';
import { MessageBubble } from './message-bubble';
import { StreamingBubble } from './streaming-bubble';

type MessageThreadProps = {
  conversationId: string | null;
  cacheKey: string;
};

const STICK_BOTTOM_PX = 80;

export function MessageThread({ conversationId, cacheKey }: MessageThreadProps) {
  const queryKey = cacheKey;
  const messagesQuery = useMessages(
    queryKey === '_pending' ? '_pending' : queryKey,
  );
  const streamingIds = useStreamingMessageIdsFor(conversationId);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  function isNearBottom(el: HTMLDivElement): boolean {
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom < STICK_BOTTOM_PX;
  }

  function onScroll(): void {
    const el = viewportRef.current;
    if (!el) return;
    stickRef.current = isNearBottom(el);
  }

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  // MessageThread does not re-render on every token (narrow zustand selector);
  // subscribe to the streaming store directly so the viewport keeps scrolling
  // as the assistant bubble grows.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const unsubscribe = useStreamingStore.subscribe(() => {
      if (!stickRef.current) return;
      el.scrollTop = el.scrollHeight;
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    stickRef.current = true;
  }, [conversationId]);

  const messages = messagesQuery.data?.messages ?? [];

  return (
    <ScrollArea className="h-full">
      <div
        ref={viewportRef}
        onScroll={onScroll}
        data-slot="message-thread-viewport"
        className="flex h-full flex-col gap-3 px-4 py-6"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streamingIds.map((id) => (
          <StreamingBubble key={id} messageId={id} />
        ))}
      </div>
    </ScrollArea>
  );
}
