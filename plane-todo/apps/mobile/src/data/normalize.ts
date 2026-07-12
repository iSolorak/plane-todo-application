/**
 * Core types list endpoints (listProjects, listStates, …) as bare arrays, but
 * some Plane deployments return the paginated envelope ({ results: [...] })
 * instead, and react-query data is undefined while pending. Every list that
 * reaches a screen or selector must pass through this: it yields a real array
 * for a bare array, unwraps { results }, and returns [] for anything else.
 */
export function normalizeList<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (
    input !== null &&
    typeof input === "object" &&
    Array.isArray((input as { results?: unknown }).results)
  ) {
    return (input as { results: T[] }).results;
  }
  return [];
}
