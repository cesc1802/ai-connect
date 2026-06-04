import { describe, expect, it } from 'vitest';
import { groupConversationsByRecency } from '@/lib/conversation-grouping';
import type { Conversation } from '@/schemas/conversation';

function conv(id: string, updatedAt: string): Conversation {
  return {
    id,
    workspaceId: 'wsp_x',
    title: id,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('groupConversationsByRecency', () => {
  // Anchor: Wed 2026-03-04 14:00 local
  const now = new Date(2026, 2, 4, 14, 0, 0);

  it('places same-local-day items in today', () => {
    const morning = new Date(2026, 2, 4, 0, 1, 0).toISOString();
    const noon = new Date(2026, 2, 4, 12, 30, 0).toISOString();
    const groups = groupConversationsByRecency([conv('a', morning), conv('b', noon)], now);
    expect(groups.today.map((c) => c.id)).toEqual(['b', 'a']);
    expect(groups.yesterday).toHaveLength(0);
  });

  it('places previous local day in yesterday', () => {
    const yesterday2330 = new Date(2026, 2, 3, 23, 30, 0).toISOString();
    const yesterday0001 = new Date(2026, 2, 3, 0, 1, 0).toISOString();
    const groups = groupConversationsByRecency(
      [conv('a', yesterday0001), conv('b', yesterday2330)],
      now,
    );
    expect(groups.yesterday.map((c) => c.id)).toEqual(['b', 'a']);
    expect(groups.today).toHaveLength(0);
  });

  it('puts items 2..7 local days back in last7Days', () => {
    const twoDays = new Date(2026, 2, 2, 10, 0, 0).toISOString();
    const sevenDays = new Date(2026, 1, 25, 23, 30, 0).toISOString();
    const groups = groupConversationsByRecency(
      [conv('a', twoDays), conv('b', sevenDays)],
      now,
    );
    expect(groups.last7Days.map((c) => c.id)).toEqual(['a', 'b']);
    expect(groups.older).toHaveLength(0);
  });

  it('puts items 8+ days back in older', () => {
    const eightDays = new Date(2026, 1, 24, 12, 0, 0).toISOString();
    const groups = groupConversationsByRecency([conv('a', eightDays)], now);
    expect(groups.older.map((c) => c.id)).toEqual(['a']);
    expect(groups.last7Days).toHaveLength(0);
  });

  it('handles midnight boundary precisely (00:00 local belongs to that day)', () => {
    const todayMidnight = new Date(2026, 2, 4, 0, 0, 0).toISOString();
    const yesterdayMidnight = new Date(2026, 2, 3, 0, 0, 0).toISOString();
    const groups = groupConversationsByRecency(
      [conv('today', todayMidnight), conv('yest', yesterdayMidnight)],
      now,
    );
    expect(groups.today.map((c) => c.id)).toEqual(['today']);
    expect(groups.yesterday.map((c) => c.id)).toEqual(['yest']);
  });

  it('treats exactly 7 days ago (local) as last7Days, 8 days as older', () => {
    const exactlySeven = new Date(2026, 1, 25, 14, 0, 0).toISOString();
    const justOver = new Date(2026, 1, 24, 13, 59, 0).toISOString();
    const groups = groupConversationsByRecency(
      [conv('seven', exactlySeven), conv('eight', justOver)],
      now,
    );
    expect(groups.last7Days.map((c) => c.id)).toEqual(['seven']);
    expect(groups.older.map((c) => c.id)).toEqual(['eight']);
  });

  it('sorts most-recent-first within each bucket', () => {
    const t1 = new Date(2026, 2, 4, 1, 0, 0).toISOString();
    const t2 = new Date(2026, 2, 4, 13, 0, 0).toISOString();
    const t3 = new Date(2026, 2, 4, 9, 0, 0).toISOString();
    const groups = groupConversationsByRecency(
      [conv('a', t1), conv('b', t2), conv('c', t3)],
      now,
    );
    expect(groups.today.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('routes unparseable updatedAt to older', () => {
    const groups = groupConversationsByRecency([conv('x', 'not-a-date')], now);
    expect(groups.older.map((c) => c.id)).toEqual(['x']);
  });
});
