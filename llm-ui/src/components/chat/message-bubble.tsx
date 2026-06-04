import { cn } from '@/lib/utils';
import type { MessageRole } from '@/schemas/conversation';

type MessageBubbleProps = {
  role: MessageRole;
  content: string;
  children?: React.ReactNode;
};

export function MessageBubble({ role, content, children }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <div
      data-role={role}
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[90%] md:max-w-[80%] whitespace-pre-wrap break-words px-4 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-[var(--chat-bubble-user)] text-primary-foreground rounded-2xl rounded-br-md'
            : 'bg-card border border-border text-card-foreground rounded-2xl rounded-bl-md',
        )}
      >
        {content}
        {children}
      </div>
    </div>
  );
}
