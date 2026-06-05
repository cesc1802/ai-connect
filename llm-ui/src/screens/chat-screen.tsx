import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TEMPLATES, TEMPLATE_CATEGORIES, PROVIDERS } from "@/lib/mock-data";

type Msg = { id: string; role: "user" | "assistant"; text: string; toolCall?: { name: string; args: string; result: string } };

const INITIAL: Msg[] = [
  { id: "m1", role: "user", text: "Giúp tôi tóm tắt báo cáo doanh số tuần trước theo từng kênh bán hàng." },
  {
    id: "m2",
    role: "assistant",
    text: "Tôi sẽ truy xuất số liệu báo cáo và tổng hợp giúp bạn.",
    toolCall: {
      name: "query_sales_report",
      args: '{ "range": "last_7d", "groupBy": "channel" }',
      result: '{ "shopee": 124, "tiktok": 87, "web": 56 }',
    },
  },
  {
    id: "m3",
    role: "assistant",
    text: "**Doanh số 7 ngày qua**\n\n- Shopee: 124 đơn (tăng 12%)\n- TikTok Shop: 87 đơn (giảm 4%)\n- Website: 56 đơn (đi ngang)\n\nKhuyến nghị: tăng ngân sách quảng cáo TikTok 15% để đảo chiều xu hướng.",
  },
];

export function ChatScreen() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tất cả");
  const [model, setModel] = useState(PROVIDERS[0].models[0]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(INITIAL);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (cat !== "Tất cả" && t.cat !== cat) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
    });
  }, [query, cat]);

  function send() {
    if (!input.trim()) return;
    setMessages((m) => [...m, { id: `u-${m.length}`, role: "user", text: input.trim() }]);
    setInput("");
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r bg-card lg:flex">
        <div className="border-b p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Templates</p>
          <div className="relative mt-2">
            <Icon name="search" className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm template..."
              className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 border-b p-2">
          {TEMPLATE_CATEGORIES.slice(0, 6).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-2xs",
                cat === c && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setInput(t.desc)}
                className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name={t.icon} className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{t.title}</p>
                  <p className="line-clamp-2 text-2xs text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b bg-card/40 px-4 py-2.5">
          <Icon name="message-square" className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Trò chuyện</span>
          <div className="ml-auto flex items-center gap-2">
            <Icon name="sliders-horizontal" className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-7 rounded-md border bg-background px-2 text-xs outline-none"
            >
              {PROVIDERS.flatMap((p) => p.models).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                m.role === "user" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
              )}>
                <Icon name={m.role === "user" ? "user" : "bot"} className="h-3.5 w-3.5" />
              </span>
              <div className={cn("max-w-2xl space-y-2 rounded-xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card")}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                {m.toolCall && (
                  <div className="rounded-lg border border-border bg-background p-3 text-foreground">
                    <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
                      <Icon name="wrench" className="h-3 w-3" /> Tool call · {m.toolCall.name}
                    </div>
                    <code className="block whitespace-pre-wrap font-mono text-2xs text-muted-foreground">args: {m.toolCall.args}</code>
                    <code className="mt-1 block whitespace-pre-wrap font-mono text-2xs">result: {m.toolCall.result}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t bg-background p-4">
          <div className="flex items-end gap-2 rounded-xl border bg-card p-2">
            <Button variant="ghost" size="icon-sm"><Icon name="paperclip" className="h-4 w-4" /></Button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Hỏi Growing bất cứ điều gì..."
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button onClick={send} disabled={!input.trim()}>
              <Icon name="send" className="h-4 w-4" /> Gửi
            </Button>
          </div>
          <p className="mt-1 text-center text-2xs text-muted-foreground">Growing có thể mắc lỗi — hãy kiểm chứng thông tin quan trọng.</p>
        </div>
      </div>
    </div>
  );
}
