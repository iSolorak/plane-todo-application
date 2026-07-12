import type { Priority, WorkItem } from "@plane-todo/core";

/** Priority order used for sorting: urgent (0) → none (4). */
const PRIORITY_ORDER: readonly Priority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

/** Numeric rank of a priority; lower sorts first. Unknown values sort last. */
export function priorityRank(priority: Priority): number {
  const idx = PRIORITY_ORDER.indexOf(priority);
  return idx === -1 ? PRIORITY_ORDER.length : idx;
}

/** Format a Date as a local "YYYY-MM-DD" calendar day. */
function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's local calendar day as "YYYY-MM-DD". */
export function todayLocalYmd(): string {
  return toLocalYmd(new Date());
}

/**
 * The date part ("YYYY-MM-DD") of a work item's `target_date`, or `null` when
 * it has none. Tolerates full ISO timestamps by taking their date portion.
 */
export function targetYmd(item: WorkItem): string | null {
  const raw = item.target_date;
  if (!raw) return null;
  return raw.slice(0, 10);
}

/**
 * Whether an item is due on or before `today` (defaults to the local day).
 * Items with no target date are never "due". Compared by date part only.
 */
export function isDueByToday(item: WorkItem, today: string = todayLocalYmd()): boolean {
  const ymd = targetYmd(item);
  if (!ymd) return false;
  return ymd <= today;
}

/**
 * Comparator: earlier `target_date` first, undated items last, then by
 * priority (urgent → none). Suitable for `Array.prototype.sort`.
 */
export function compareByTargetThenPriority(a: WorkItem, b: WorkItem): number {
  const at = targetYmd(a);
  const bt = targetYmd(b);
  if (at !== bt) {
    if (at === null) return 1; // nulls last
    if (bt === null) return -1;
    return at < bt ? -1 : 1;
  }
  return priorityRank(a.priority) - priorityRank(b.priority);
}

/**
 * Sort by target date then priority without mutating the input. Returns `[]`
 * for non-array input (e.g. a loading/undefined state) instead of throwing.
 */
export function sortByTargetThenPriority(items: WorkItem[]): WorkItem[] {
  if (!Array.isArray(items)) return [];
  return [...items].sort(compareByTargetThenPriority);
}
