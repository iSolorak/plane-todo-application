import type { WorkItem } from "@plane-todo/core";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { qk } from "./queryKeys";

type WorkItemUpdater = (item: WorkItem) => WorkItem;

/** Snapshot of every cache entry we optimistically touched, for rollback. */
export interface CacheSnapshot {
  entries: Array<[QueryKey, unknown]>;
  tempId?: string;
}

function mapList(
  list: WorkItem[] | undefined,
  id: string,
  update: WorkItemUpdater,
): WorkItem[] | undefined {
  return list?.map((item) => (item.id === id ? update(item) : item));
}

function removeCreatedDuplicates(
  list: WorkItem[] | undefined,
  tempId: string,
  itemId: string,
): WorkItem[] | undefined {
  return list?.filter((item) => item.id !== tempId && item.id !== itemId);
}

/**
 * Optimistically apply `update` to the given item everywhere it appears
 * (detail, every Today list, and every All list) and return a
 * snapshot for rollback. Callers must `cancelQueries` awareness via this helper.
 */
export async function applyOptimisticPatch(
  qc: QueryClient,
  projectId: string,
  id: string,
  update: WorkItemUpdater,
): Promise<CacheSnapshot> {
  await qc.cancelQueries();
  const entries: Array<[QueryKey, unknown]> = [];

  const detailKey = qk.workItem(projectId, id);
  entries.push([detailKey, qc.getQueryData(detailKey)]);
  qc.setQueryData<WorkItem>(detailKey, (prev) => (prev ? update(prev) : prev));

  for (const [key, data] of qc.getQueriesData<WorkItem[]>({
    queryKey: qk.todayAll(),
  })) {
    entries.push([key, data]);
    qc.setQueryData<WorkItem[]>(key, (prev) => mapList(prev, id, update));
  }

  for (const [key, data] of qc.getQueriesData<WorkItem[]>({
    queryKey: qk.allItemsAll(),
  })) {
    entries.push([key, data]);
    qc.setQueryData<WorkItem[]>(key, (prev) => mapList(prev, id, update));
  }

  return { entries };
}

/**
 * Optimistically insert a freshly-created item at the front of the relevant
 * lists (Today when due, and every matching All list).
 */
export async function applyOptimisticInsert(
  qc: QueryClient,
  projectId: string,
  item: WorkItem,
  dueToday: boolean,
): Promise<CacheSnapshot> {
  await qc.cancelQueries();
  const entries: Array<[QueryKey, unknown]> = [];

  if (dueToday) {
    for (const [key, data] of qc.getQueriesData<WorkItem[]>({
      queryKey: qk.todayAll(),
    })) {
      entries.push([key, data]);
      qc.setQueryData<WorkItem[]>(key, (prev) => (prev ? [item, ...prev] : prev));
    }
  }

  for (const [key, data] of qc.getQueriesData<WorkItem[]>({
    queryKey: qk.allItemsAll(),
  })) {
    entries.push([key, data]);
    qc.setQueryData<WorkItem[]>(key, (prev) =>
      prev && keyContainsProject(key, projectId) ? [item, ...prev] : prev,
    );
  }

  return { entries, tempId: item.id };
}

export function reconcileCreatedItem(
  qc: QueryClient,
  projectId: string,
  tempId: string | undefined,
  item: WorkItem,
  dueToday: boolean,
): void {
  if (!tempId) return;

  for (const [key] of qc.getQueriesData<WorkItem[]>({
    queryKey: qk.todayAll(),
  })) {
    qc.setQueryData<WorkItem[]>(key, (prev) => {
      const withoutCreated = removeCreatedDuplicates(prev, tempId, item.id);
      if (!withoutCreated || !dueToday || !keyContainsProject(key, projectId)) {
        return withoutCreated;
      }
      return [item, ...withoutCreated];
    });
  }

  for (const [key] of qc.getQueriesData<WorkItem[]>({
    queryKey: qk.allItemsAll(),
  })) {
    qc.setQueryData<WorkItem[]>(key, (prev) => {
      const withoutCreated = removeCreatedDuplicates(prev, tempId, item.id);
      if (!withoutCreated || !keyContainsProject(key, projectId)) {
        return withoutCreated;
      }
      return [item, ...withoutCreated];
    });
  }

  qc.setQueryData<WorkItem>(qk.workItem(projectId, item.id), item);
}

export function rollback(qc: QueryClient, snapshot: CacheSnapshot): void {
  for (const [key, data] of snapshot.entries) {
    qc.setQueryData(key, data);
  }
}

/** Refetch canonical data after a mutation settles. */
export function invalidateItemQueries(
  qc: QueryClient,
  projectId: string,
  id?: string,
): void {
  void qc.invalidateQueries({ queryKey: qk.todayAll() });
  void qc.invalidateQueries({ queryKey: qk.allItemsAll() });
  if (id) void qc.invalidateQueries({ queryKey: qk.workItem(projectId, id) });
}

function keyContainsProject(key: QueryKey, projectId: string): boolean {
  const projectIds = key[1];
  return Array.isArray(projectIds) && projectIds.includes(projectId);
}
