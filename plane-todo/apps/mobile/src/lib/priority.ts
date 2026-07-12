import type { Priority } from "@plane-todo/core";

/** All priorities in severity order (highest first). */
export const PRIORITIES: readonly Priority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

/** Human-readable label for a priority. */
export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.none;
}

/** Accent color per priority (urgent uses the theme's red). */
export const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#c94a3a",
  high: "#e0803a",
  medium: "#d9a72c",
  low: "#4a86c9",
  none: "#8a8175",
};
