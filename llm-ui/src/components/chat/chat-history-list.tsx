import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { CONVERSATIONS, type Conversation } from "@/lib/mock-data";

export interface ChatHistoryListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// Conversations sidebar. Mirrors ChatGPT-style left rail: "new chat"
// button, search, then a grouped list (Hôm nay / Hôm qua / 7 ngày qua /
// Cũ hơn). Search hits both title and preview, case-insensitive.
export function ChatHistoryList({ selectedId, onSelect }: ChatHistoryListProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => groupConversations(query), [query]);

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-r bg-card lg:flex">
      <div className="space-y-2 border-b p-3">
        <button
          onClick={() => onSelect(null)}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <Icon name="square-pen" className="h-3.5 w-3.5" />
          Trò chuyện mới
        </button>
        <div className="relative">
          <Icon name="search" className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm hội thoại..."
            className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-6 text-center text-2xs text-muted-foreground">
            Không có hội thoại trùng khớp.
          </p>
        ) : (
          grouped.map(([group, items]) => (
            <div key={group} className="mb-3">
              <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelect(c.id)}
                      className={cn(
                        "group flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent",
                        selectedId === c.id && "bg-accent",
                      )}
                    >
                      <Icon
                        name="message-square"
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          selectedId === c.id ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-xs font-medium">{c.title}</p>
                          <span className="shrink-0 text-2xs text-muted-foreground">
                            {c.updatedLabel}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-2xs text-muted-foreground">
                          {c.preview}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

const GROUP_ORDER: Conversation["group"][] = [
  "Hôm nay",
  "Hôm qua",
  "7 ngày qua",
  "Cũ hơn",
];

function groupConversations(query: string): Array<[string, Conversation[]]> {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? CONVERSATIONS.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.preview.toLowerCase().includes(q),
      )
    : CONVERSATIONS;
  return GROUP_ORDER.map((g) => [
    g,
    filtered.filter((c) => c.group === g),
  ] as [string, Conversation[]]).filter(([, items]) => items.length > 0);
}
