import type { State, WorkItem } from "@plane-todo/core";
import { isDoneGroup } from "./states";

/**
 * Extract the expanded State object from a work item. Plane returns `state` as
 * a bare id unless the request used `expand=state`; this returns the object
 * only when it's actually expanded.
 */
export function getExpandedState(item: WorkItem): State | undefined {
  const state = item.state;
  return state !== null && typeof state === "object" ? state : undefined;
}

/**
 * A work item is "done" iff its current state's group is 'completed' or
 * 'cancelled'. Requires the state to be expanded (see {@link getExpandedState});
 * without expansion this conservatively returns false.
 */
export function isDone(item: WorkItem): boolean {
  const state = getExpandedState(item);
  return state ? isDoneGroup(state.group) : false;
}
