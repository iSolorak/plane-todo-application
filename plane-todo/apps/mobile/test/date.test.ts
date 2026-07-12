import { describe, it, expect } from "vitest";
import type { Priority, WorkItem } from "@plane-todo/core";
import {
  compareByTargetThenPriority,
  isDueByToday,
  priorityRank,
  sortByTargetThenPriority,
} from "../src/lib/date";

function wi(id: string, target_date: string | null, priority: Priority): WorkItem {
  return {
    id,
    name: id,
    description_html: null,
    sequence_id: 1,
    state: null,
    priority,
    assignees: [],
    labels: [],
    start_date: null,
    target_date,
    project_id: "p1",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

const TODAY = "2026-07-07";

describe("priorityRank", () => {
  it("orders urgent < high < medium < low < none", () => {
    expect(priorityRank("urgent")).toBeLessThan(priorityRank("high"));
    expect(priorityRank("high")).toBeLessThan(priorityRank("medium"));
    expect(priorityRank("medium")).toBeLessThan(priorityRank("low"));
    expect(priorityRank("low")).toBeLessThan(priorityRank("none"));
  });
});

describe("isDueByToday", () => {
  it("is true for overdue and today, false for future/none", () => {
    expect(isDueByToday(wi("a", "2026-07-06", "none"), TODAY)).toBe(true);
    expect(isDueByToday(wi("b", "2026-07-07", "none"), TODAY)).toBe(true);
    expect(isDueByToday(wi("c", "2026-07-08", "none"), TODAY)).toBe(false);
    expect(isDueByToday(wi("d", null, "none"), TODAY)).toBe(false);
  });

  it("handles full ISO timestamps by date part", () => {
    expect(isDueByToday(wi("e", "2026-07-07T23:00:00Z", "none"), TODAY)).toBe(true);
  });
});

describe("sortByTargetThenPriority", () => {
  it("sorts by target_date asc, then by priority, nulls last", () => {
    const items = [
      wi("future", "2026-07-10", "urgent"),
      wi("today-low", "2026-07-07", "low"),
      wi("today-urgent", "2026-07-07", "urgent"),
      wi("nodate", null, "urgent"),
    ];
    expect(sortByTargetThenPriority(items).map((i) => i.id)).toEqual([
      "today-urgent",
      "today-low",
      "future",
      "nodate",
    ]);
  });

  it("returns [] for undefined input (loading state) instead of throwing", () => {
    expect(sortByTargetThenPriority(undefined as unknown as WorkItem[])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const items = [wi("a", "2026-07-08", "none"), wi("b", "2026-07-07", "none")];
    const copy = [...items];
    sortByTargetThenPriority(items);
    expect(items).toEqual(copy);
  });

  it("compareByTargetThenPriority puts nulls after dated items", () => {
    expect(
      compareByTargetThenPriority(wi("x", null, "urgent"), wi("y", "2026-07-07", "none")),
    ).toBeGreaterThan(0);
  });
});
