import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useComposerDraftStore } from '@/stores/composer-draft-store';

type ComposerProps = {
  disabled?: boolean;
  placeholder?: string;
  modelLabel?: string;
  onSubmit: (text: string) => void;
};

export type ComposerHandle = {
  focus: () => void;
};

const MAX_HEIGHT_PX = 240;

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { disabled, placeholder = 'Type a message…', modelLabel = 'assistant', onSubmit },
  ref,
) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingDraft = useComposerDraftStore((s) => s.pending);
  const consumeDraft = useComposerDraftStore((s) => s.consume);
  const lastAppliedDraftId = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    if (!pendingDraft) return;
    if (pendingDraft.id === lastAppliedDraftId.current) return;
    lastAppliedDraftId.current = pendingDraft.id;
    const consumed = consumeDraft();
    if (!consumed) return;

    setText((prev) => {
      if (consumed.mode === 'seed') return prev.length === 0 ? consumed.text : prev;
      const ta = textareaRef.current;
      const sep = prev.length > 0 && !prev.endsWith('\n') ? '\n\n' : '';
      const cursor = ta?.selectionStart ?? prev.length;
      const before = prev.slice(0, cursor);
      const after = prev.slice(cursor);
      const beforeSep = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '';
      const afterSep = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '';
      if (cursor === prev.length) return prev + sep + consumed.text;
      return before + beforeSep + consumed.text + afterSep + after;
    });
    queueMicrotask(() => textareaRef.current?.focus());
  }, [pendingDraft, consumeDraft]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const canSend = !disabled && text.trim().length > 0;

  function send(): void {
    if (!canSend) return;
    onSubmit(text.trim());
    setText('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <form
      className="border-border bg-background flex items-end gap-2 border-t px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        aria-label={`Message ${modelLabel}`}
        disabled={disabled}
        className={cn(
          'min-h-[2.5rem] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:opacity-50',
        )}
      />
      <Button
        type="submit"
        size="icon"
        aria-label="Send message"
        disabled={!canSend}
      >
        <Send className="size-4" />
      </Button>
    </form>
  );
});
