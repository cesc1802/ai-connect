import type { Conversation } from '@/schemas/conversation';

export type ConversationRecencyGroups = {
  today: Conversation[];
  yesterday: Conversation[];
  last7Days: Conversation[];
  older: Conversation[];
};

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Buckets conversations by local calendar day relative to `now`:
 *   - today:     updatedAt on the same local day as `now`
 *   - yesterday: updatedAt on the local day before `now`
 *   - last7Days: 2..7 local days before `now`
 *   - older:     everything else (including future-dated, defensive)
 * Sorted most-recent-first within each bucket. Pure; `now` is injectable for tests.
 * BR-107 expects local-tz day boundaries.
 */
export function groupConversationsByRecency(
  conversations: Conversation[],
  now: Date = new Date(),
): ConversationRecencyGroups {
  const groups: ConversationRecencyGroups = {
    today: [],
    yesterday: [],
    last7Days: [],
    older: [],
  };

  const todayStart = startOfLocalDay(now);
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (const c of conversations) {
    const updated = new Date(c.updatedAt);
    if (Number.isNaN(updated.getTime())) {
      groups.older.push(c);
      continue;
    }
    const updatedDayStart = startOfLocalDay(updated);
    const dayDiff = Math.round((todayStart - updatedDayStart) / oneDayMs);

    if (dayDiff <= 0) groups.today.push(c);
    else if (dayDiff === 1) groups.yesterday.push(c);
    else if (dayDiff <= 7) groups.last7Days.push(c);
    else groups.older.push(c);
  }

  const byUpdatedDesc = (a: Conversation, b: Conversation) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  groups.today.sort(byUpdatedDesc);
  groups.yesterday.sort(byUpdatedDesc);
  groups.last7Days.sort(byUpdatedDesc);
  groups.older.sort(byUpdatedDesc);

  return groups;
}
