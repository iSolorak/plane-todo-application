/** Centralized react-query key factory so invalidation stays consistent. */
export const qk = {
  projects: () => ["projects"] as const,
  states: (projectId: string) => ["states", projectId] as const,
  /** Today view is keyed by the (sorted) set of projects it spans. */
  today: (projectIds: string[]) => ["today", [...projectIds].sort()] as const,
  /** Prefix matcher for invalidating all Today queries regardless of projects. */
  todayAll: () => ["today"] as const,
  allItems: (projectIds: string[]) =>
    ["all-items", [...projectIds].sort()] as const,
  /** Prefix matcher for invalidating every All query regardless of filter. */
  allItemsAll: () => ["all-items"] as const,
  workItem: (projectId: string, id: string) =>
    ["work-item", projectId, id] as const,
  notifierConfig: (baseUrl: string) => ["notifier-config", baseUrl] as const,
};
