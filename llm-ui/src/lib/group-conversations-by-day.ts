import type { ConversationSummary } from "./conversations-api";

// Pure day-bucketing for the chat rail: real conversations carry epoch-ms
// `updatedAt`; the UI groups them under Hôm nay / Hôm qua / Trước đó.

export type DayBucketKey = "today" | "yesterday" | "older";

export const DAY_BUCKETS: Array<[DayBucketKey, string]> = [
  ["today", "Hôm nay"],
  ["yesterday", "Hôm qua"],
  ["older", "Trước đó"],
];

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayBucket(updatedAt: number, now: number = Date.now()): DayBucketKey {
  const today = startOfDay(now);
  if (updatedAt >= today) return "today";
  if (updatedAt >= today - DAY_MS) return "yesterday";
  return "older";
}

export function conversationTimeLabel(updatedAt: number, now: number = Date.now()): string {
  const bucket = dayBucket(updatedAt, now);
  const d = new Date(updatedAt);
  if (bucket === "today") {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  if (bucket === "yesterday") return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function groupConversationsByDay(
  conversations: ConversationSummary[],
  now: number = Date.now(),
): Record<DayBucketKey, ConversationSummary[]> {
  const groups: Record<DayBucketKey, ConversationSummary[]> = {
    today: [],
    yesterday: [],
    older: [],
  };
  for (const c of conversations) {
    groups[dayBucket(c.updatedAt, now)].push(c);
  }
  return groups;
}
