import type { WorkItem } from "@plane-todo/core";
import { isDone } from "../data/done";

export interface FilterOptions {
  /** When false, completed/cancelled items are hidden. */
  showDone: boolean;
}

/**
 * Filter a work-item list for display. Hides "done" (completed/cancelled)
 * items unless `showDone` is set. Returns `[]` for non-array input (loading
 * states or accidentally-passed paginated wrappers) instead of throwing.
 */
export function filterItems(items: WorkItem[], { showDone }: FilterOptions): WorkItem[] {
  if (!Array.isArray(items)) return [];
  if (showDone) return items;
  return items.filter((item) => !isDone(item));
}

/** Count "done" (completed/cancelled) items. Returns 0 for non-array input. */
export function countDone(items: WorkItem[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((n, item) => (isDone(item) ? n + 1 : n), 0);
}
