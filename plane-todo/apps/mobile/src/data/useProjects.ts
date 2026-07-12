import type { Project } from "@plane-todo/core";
import { useQuery } from "@tanstack/react-query";
import { usePlaneClient } from "./client";
import { normalizeList } from "./normalize";
import { qk } from "./queryKeys";

export interface UseProjectsResult {
  /** ALWAYS a Project[] — [] while pending or on error, never the wrapper. */
  projects: Project[];
  /** True until the first result (or error) arrives. */
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Single source of truth for the workspace's projects. The select() normalizes
 * whatever the server sent (bare array or paginated { results } envelope) into
 * a bare Project[]; consumers additionally get `projects` defaulted to [] so
 * no screen ever computes over undefined or a wrapper.
 */
export function useProjects(): UseProjectsResult {
  const client = usePlaneClient();
  const query = useQuery({
    queryKey: qk.projects(),
    queryFn: () => client.listProjects(),
    select: (raw) => normalizeList<Project>(raw),
    staleTime: 5 * 60 * 1000,
  });

  return {
    projects: query.data ?? [],
    isPending: query.isPending,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
