import { describe, it, expect } from "vitest";
import type { State, StateGroup, WorkItem } from "@plane-todo/core";
import { getExpandedState, isDone } from "../src/data/done";

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

function item(state: WorkItem["state"]): WorkItem {
  return {
    id: "wi1",
    name: "Task",
    description_html: null,
    sequence_id: 1,
    state,
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

describe("getExpandedState", () => {
  it("returns the object only when state is expanded", () => {
    expect(getExpandedState(item(state("started")))?.group).toBe("started");
    expect(getExpandedState(item("bare-id"))).toBeUndefined();
    expect(getExpandedState(item(null))).toBeUndefined();
  });
});

describe("isDone", () => {
  it("is true when the expanded state group is completed or cancelled", () => {
    expect(isDone(item(state("completed")))).toBe(true);
    expect(isDone(item(state("cancelled")))).toBe(true);
  });

  it("is false for active groups", () => {
    expect(isDone(item(state("backlog")))).toBe(false);
    expect(isDone(item(state("unstarted")))).toBe(false);
    expect(isDone(item(state("started")))).toBe(false);
    expect(isDone(item(state("triage")))).toBe(false);
  });

  it("is false (conservative) when state is not expanded", () => {
    expect(isDone(item("bare-id"))).toBe(false);
    expect(isDone(item(null))).toBe(false);
  });
});
