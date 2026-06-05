import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Composer, type ComposerHandle } from '@/components/chat/composer';
import { ConnectionStatusBadge } from '@/components/chat/connection-status-badge';
import { EmptyState } from '@/components/chat/empty-state';
import { MessageThread } from '@/components/chat/message-thread';
import { ModelSelector } from '@/components/chat/model-selector';
import { TemplatePickerRail } from '@/components/chat/template-picker-rail';
import { useChatSession } from '@/hooks/use-chat-session';
import { useActiveWorkspaceStore } from '@/stores/active-workspace-store';
import { useStreamingStore } from '@/stores/streaming-store';

export function ChatPage() {
  const params = useParams({ strict: false }) as { conversationId?: string };
  const conversationId = params.conversationId ?? null;
  const navigate = useNavigate();
  const workspaceId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const { status, sendMessage } = useChatSession();
  const composerRef = useRef<ComposerHandle | null>(null);
  const lastPendingNavigatedRef = useRef<string | null>(null);

  useEffect(() => {
    composerRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (conversationId != null) return;
    const unsub = useStreamingStore.subscribe((state) => {
      const ids = Object.entries(state.entries);
      const first = ids.find(([, e]) => e.status === 'streaming');
      if (!first) return;
      const newConvId = first[1].conversationId;
      if (newConvId && lastPendingNavigatedRef.current !== newConvId) {
        lastPendingNavigatedRef.current = newConvId;
        navigate({ to: '/chat/$conversationId', params: { conversationId: newConvId } });
      }
    });
    return () => {
      unsub();
      lastPendingNavigatedRef.current = null;
    };
  }, [conversationId, navigate]);

  function onSubmit(text: string): void {
    if (!workspaceId) {
      toast.error('Pick a workspace before sending a message');
      return;
    }
    sendMessage({ text, conversationId, workspaceId });
  }

  const composerDisabled = status !== 'open' || workspaceId == null;
  const cacheKey = conversationId ?? '_pending';
  const hasContent = conversationId != null;

  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      <TemplatePickerRail />
      <div className="grid min-h-0 grid-rows-[auto_1fr_auto]">
        <div className="border-border bg-background flex items-center justify-between gap-2 border-b px-4 py-2">
          <div className="min-w-0 truncate text-sm font-medium">
            {conversationId ? 'Conversation' : 'New conversation'}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <ModelSelector className="min-w-0" />
            <ConnectionStatusBadge status={status} />
          </div>
        </div>
        <div className="min-h-0">
          {hasContent ? (
            <MessageThread conversationId={conversationId} cacheKey={cacheKey} />
          ) : (
            <PendingOrEmpty cacheKey={cacheKey} />
          )}
        </div>
        <Composer
          ref={composerRef}
          disabled={composerDisabled}
          placeholder="Nhập tin nhắn…"
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function PendingOrEmpty({ cacheKey }: { cacheKey: string }) {
  const hasPendingStream = useStreamingStore((s) =>
    Object.values(s.entries).some((e) => e.conversationId === null),
  );
  if (!hasPendingStream) {
    return <EmptyState />;
  }
  return <MessageThread conversationId={null} cacheKey={cacheKey} />;
}
