import { describe, it, expect } from "vitest";
import type { State, StateGroup } from "@plane-todo/core";
import {
  isDoneGroup,
  pickCompleteState,
  pickReopenState,
} from "../src/data/states";

function st(
  id: string,
  group: StateGroup,
  sequence: number,
  isDefault = false,
): State {
  return {
    id,
    name: id,
    color: "#000",
    group,
    sequence,
    default: isDefault,
    project_id: "p1",
  };
}

// A realistic Plane workflow, deliberately out of sequence order.
const WORKFLOW: State[] = [
  st("done-late", "completed", 5000),
  st("todo", "unstarted", 2000, true), // the single project default
  st("backlog", "backlog", 1000),
  st("in-progress", "started", 3000),
  st("done-early", "completed", 4000),
  st("cancelled", "cancelled", 6000),
];

describe("isDoneGroup", () => {
  it("is true only for completed and cancelled", () => {
    expect(isDoneGroup("completed")).toBe(true);
    expect(isDoneGroup("cancelled")).toBe(true);
    expect(isDoneGroup("started")).toBe(false);
    expect(isDoneGroup("unstarted")).toBe(false);
    expect(isDoneGroup("backlog")).toBe(false);
    expect(isDoneGroup("triage")).toBe(false);
    expect(isDoneGroup(undefined)).toBe(false);
  });
});

describe("pickCompleteState", () => {
  it("prefers a completed state flagged default", () => {
    const states = [...WORKFLOW, st("done-default", "completed", 9000, true)];
    expect(pickCompleteState(states)?.id).toBe("done-default");
  });

  it("falls back to the lowest-sequence completed state", () => {
    // No completed state is default → lowest sequence among completed wins.
    expect(pickCompleteState(WORKFLOW)?.id).toBe("done-early"); // 4000 < 5000
  });

  it("returns undefined when there are no completed states", () => {
    const noCompleted = WORKFLOW.filter((s) => s.group !== "completed");
    expect(pickCompleteState(noCompleted)).toBeUndefined();
  });
});

describe("pickReopenState", () => {
  it("prefers the project default state", () => {
    expect(pickReopenState(WORKFLOW)?.id).toBe("todo");
  });

  it("falls back to the lowest-sequence unstarted state when no default", () => {
    const noDefault = WORKFLOW.map((s) => ({ ...s, default: false }));
    const withSecondUnstarted = [
      ...noDefault,
      st("triage-then-todo", "unstarted", 500),
    ];
    expect(pickReopenState(withSecondUnstarted)?.id).toBe("triage-then-todo");
  });

  it("returns undefined when no default and no unstarted states", () => {
    const only = [st("done", "completed", 1, false)];
    expect(pickReopenState(only)).toBeUndefined();
  });
});
