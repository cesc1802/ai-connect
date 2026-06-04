import { MessageSquarePlus } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="bg-card border-border text-card-foreground flex max-w-md flex-col items-center gap-3 rounded-2xl border p-8 text-center shadow-sm">
        <MessageSquarePlus className="text-muted-foreground size-10" />
        <h2 className="text-base font-semibold">Start a new conversation</h2>
        <p className="text-muted-foreground text-sm">
          Type a message below to begin, or pick an existing conversation from the sidebar.
        </p>
      </div>
    </div>
  );
}
