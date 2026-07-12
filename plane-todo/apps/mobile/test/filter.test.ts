import { describe, it, expect } from "vitest";
import type { State, StateGroup, WorkItem } from "@plane-todo/core";
import { countDone, filterItems } from "../src/lib/filterItems";

function state(group: StateGroup): State {
  return {
    id: `st-${group}`,
    name: group,
    color: "#000",
    group,
    sequence: 1,
    default: false,
  };
}

function item(id: string, group: StateGroup): WorkItem {
  return {
    id,
    name: id,
    description_html: null,
    sequence_id: 1,
    state: state(group),
    priority: "none",
    assignees: [],
    labels: [],
    start_date: null,
    target_date: null,
    project_id: "p1",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

const ITEMS: WorkItem[] = [
  item("a", "unstarted"),
  item("b", "completed"),
  item("c", "started"),
  item("d", "cancelled"),
];

describe("filterItems", () => {
  it("hides done (completed/cancelled) items by default", () => {
    const visible = filterItems(ITEMS, { showDone: false });
    expect(visible.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("includes everything when showDone is on", () => {
    const visible = filterItems(ITEMS, { showDone: true });
    expect(visible.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("countDone", () => {
  it("counts completed and cancelled items", () => {
    expect(countDone(ITEMS)).toBe(2);
  });
});

describe("non-array guards (loading / wrapper data must not throw)", () => {
  it("filterItems returns [] for undefined or wrapper input", () => {
    expect(filterItems(undefined as unknown as WorkItem[], { showDone: false })).toEqual([]);
    expect(
      filterItems({ results: ITEMS } as unknown as WorkItem[], { showDone: true }),
    ).toEqual([]);
  });

  it("countDone returns 0 for undefined input", () => {
    expect(countDone(undefined as unknown as WorkItem[])).toBe(0);
  });
});
