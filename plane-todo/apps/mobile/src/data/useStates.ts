import type { PlaneClient, State } from "@plane-todo/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePlaneClient } from "./client";
import { normalizeList } from "./normalize";
import { qk } from "./queryKeys";

/**
 * States change very rarely (a project admin edits the workflow), so we cache
 * them aggressively and reuse across the whole session.
 */
export const STATES_STALE_TIME_MS = 1000 * 60 * 60; // 1 hour

/**
 * Fetch a project's states normalized to a bare State[] (some deployments
 * return the paginated { results } envelope). Shared by the hook below and by
 * imperative fetches (useToggleDone's ensureQueryData) so the cache always
 * holds an array.
 */
export async function fetchStates(
  client: PlaneClient,
  projectId: string,
): Promise<State[]> {
  return normalizeList<State>(await client.listStates(projectId));
}

/** Load and cache the workflow states for a project. Data is always State[]. */
export function useStates(projectId: string): UseQueryResult<State[]> {
  const client = usePlaneClient();
  return useQuery({
    queryKey: qk.states(projectId),
    queryFn: () => fetchStates(client, projectId),
    staleTime: STATES_STALE_TIME_MS,
    gcTime: STATES_STALE_TIME_MS * 24,
  });
}
