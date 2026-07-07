import type { WorkItem } from "@plane-todo/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePlaneClient } from "./client";
import { qk } from "./queryKeys";

/**
 * List a project's work items with the `state` relation expanded, so each
 * item's `state.group` is available inline and `isDone(item)` works without a
 * second lookup.
 */
export function useWorkItems(projectId: string): UseQueryResult<WorkItem[]> {
  const client = usePlaneClient();
  return useQuery({
    queryKey: qk.workItems(projectId),
    queryFn: async () => {
      const page = await client.listWorkItems(projectId, {
        expand: ["state"],
        per_page: 100,
        order_by: "target_date",
      });
      return page.results;
    },
  });
}
