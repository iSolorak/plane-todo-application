import type { WorkItem } from "@plane-todo/core";

/**
 * Resolve a work item's project id. Core types `project_id` as required, but
 * some Plane deployments return the reference as `project` instead (the same
 * alias the notifier's webhook handler copes with), leaving `project_id`
 * undefined at runtime. Falls back to the project the query fetched from.
 */
export function resolveProjectId(
  item: WorkItem,
  fetchedProjectId?: string,
): string | undefined {
  if (typeof item.project_id === "string" && item.project_id) {
    return item.project_id;
  }
  const alias = (item as { project?: unknown }).project;
  if (typeof alias === "string" && alias) return alias;
  return fetchedProjectId || undefined;
}

/**
 * Stamp a guaranteed `project_id` onto an item fetched from a known project,
 * so navigation params and mutations downstream can rely on it.
 */
export function withProjectId(item: WorkItem, fetchedProjectId: string): WorkItem {
  const resolved = resolveProjectId(item, fetchedProjectId);
  if (item.project_id === resolved) return item;
  return { ...item, project_id: resolved ?? fetchedProjectId };
}
