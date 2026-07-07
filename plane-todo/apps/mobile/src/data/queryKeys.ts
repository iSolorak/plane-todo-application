/** Centralized react-query key factory so invalidation stays consistent. */
export const qk = {
  states: (projectId: string) => ["states", projectId] as const,
  workItems: (projectId: string) => ["work-items", projectId] as const,
  workItem: (projectId: string, id: string) =>
    ["work-items", projectId, id] as const,
};
