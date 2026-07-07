import type { State } from "@plane-todo/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePlaneClient } from "./client";
import { qk } from "./queryKeys";

/**
 * States change very rarely (a project admin edits the workflow), so we cache
 * them aggressively and reuse across the whole session.
 */
export const STATES_STALE_TIME_MS = 1000 * 60 * 60; // 1 hour

/** Load and cache the workflow states for a project. */
export function useStates(projectId: string): UseQueryResult<State[]> {
  const client = usePlaneClient();
  return useQuery({
    queryKey: qk.states(projectId),
    queryFn: () => client.listStates(projectId),
    staleTime: STATES_STALE_TIME_MS,
    gcTime: STATES_STALE_TIME_MS * 24,
  });
}
