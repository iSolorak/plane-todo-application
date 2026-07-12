import type { State, StateGroup } from "@plane-todo/core";

/** State groups that mean a work item is finished. */
export const DONE_GROUPS: readonly StateGroup[] = ["completed", "cancelled"];

/** True when a state group represents a finished item (completed/cancelled). */
export function isDoneGroup(group: StateGroup | undefined | null): boolean {
  return group === "completed" || group === "cancelled";
}

function bySequence(a: State, b: State): number {
  return a.sequence - b.sequence;
}

/**
 * The state to move an item into when marking it done:
 *   - the project's default *completed* state, if one is flagged, else
 *   - the completed state with the lowest sequence.
 * Returns undefined when the project has no completed states configured.
 */
export function pickCompleteState(states: State[]): State | undefined {
  if (!Array.isArray(states)) return undefined;
  const completed = states.filter((s) => s.group === "completed");
  if (completed.length === 0) return undefined;
  return (
    completed.find((s) => s.default) ?? [...completed].sort(bySequence)[0]
  );
}

/**
 * The state to move an item back into when reopening:
 *   - the project's default state, if one is flagged, else
 *   - the 'unstarted' state with the lowest sequence.
 *
 * Assumes the project default is not itself a done state (true for Plane, where
 * the single default is a backlog/unstarted state used for new issues).
 */
export function pickReopenState(states: State[]): State | undefined {
  if (!Array.isArray(states)) return undefined;
  const projectDefault = states.find((s) => s.default);
  if (projectDefault) return projectDefault;
  const unstarted = states.filter((s) => s.group === "unstarted");
  return [...unstarted].sort(bySequence)[0];
}
