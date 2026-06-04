import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type ChatSearchProps = {
  value: string;
  onChange: (next: string) => void;
};

export function ChatSearch({ value, onChange }: ChatSearchProps) {
  return (
    <div className="relative px-2">
      <Search className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search conversations"
        aria-label="Search conversations"
        className="h-8 pl-7 pr-7 text-sm"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className="absolute right-3 top-1/2 size-6 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
