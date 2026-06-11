import { describe, it, expect } from "vitest";
import type { ConversationSummary } from "../conversations-api";
import {
  dayBucket,
  conversationTimeLabel,
  groupConversationsByDay,
} from "../group-conversations-by-day";

// Fixed reference clock: 2026-06-11 15:00 local time.
const NOW = new Date(2026, 5, 11, 15, 0, 0).getTime();
const startOfToday = new Date(2026, 5, 11, 0, 0, 0).getTime();

function conv(id: string, updatedAt: number): ConversationSummary {
  return { id, workspaceId: "ws-1", title: id, templateId: null, createdAt: updatedAt, updatedAt };
}

describe("dayBucket", () => {
  it("buckets a timestamp from earlier today as today", () => {
    expect(dayBucket(new Date(2026, 5, 11, 8, 30).getTime(), NOW)).toBe("today");
  });

  it("buckets exactly midnight today as today", () => {
    expect(dayBucket(startOfToday, NOW)).toBe("today");
  });

  it("buckets one millisecond before midnight as yesterday", () => {
    expect(dayBucket(startOfToday - 1, NOW)).toBe("yesterday");
  });

  it("buckets the start of yesterday as yesterday", () => {
    expect(dayBucket(new Date(2026, 5, 10, 0, 0, 0).getTime(), NOW)).toBe("yesterday");
  });

  it("buckets two days ago as older", () => {
    expect(dayBucket(new Date(2026, 5, 9, 23, 59).getTime(), NOW)).toBe("older");
  });
});

describe("conversationTimeLabel", () => {
  it("shows a clock time for today", () => {
    const label = conversationTimeLabel(new Date(2026, 5, 11, 9, 5).getTime(), NOW);
    expect(label).toMatch(/09:05/);
  });

  it("shows 'Hôm qua' for yesterday", () => {
    expect(conversationTimeLabel(new Date(2026, 5, 10, 12, 0).getTime(), NOW)).toBe("Hôm qua");
  });

  it("shows a day/month date for older conversations", () => {
    const label = conversationTimeLabel(new Date(2026, 4, 1, 12, 0).getTime(), NOW);
    // vi-VN renders dd-MM in Node and dd/MM in some browsers; accept both.
    expect(label).toMatch(/01[-/]05/);
  });
});

describe("groupConversationsByDay", () => {
  it("splits conversations into the three buckets", () => {
    const today = conv("a", new Date(2026, 5, 11, 10, 0).getTime());
    const yesterday = conv("b", new Date(2026, 5, 10, 10, 0).getTime());
    const older = conv("c", new Date(2026, 5, 1, 10, 0).getTime());

    const groups = groupConversationsByDay([today, yesterday, older], NOW);

    expect(groups.today.map((c) => c.id)).toEqual(["a"]);
    expect(groups.yesterday.map((c) => c.id)).toEqual(["b"]);
    expect(groups.older.map((c) => c.id)).toEqual(["c"]);
  });

  it("returns empty buckets for an empty list", () => {
    expect(groupConversationsByDay([], NOW)).toEqual({ today: [], yesterday: [], older: [] });
  });
});
