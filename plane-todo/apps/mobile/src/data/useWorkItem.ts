import type { WorkItem } from "@plane-todo/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePlaneClient } from "./client";
import { withProjectId } from "./itemRefs";
import { qk } from "./queryKeys";

/** Load a single work item with its state expanded (so `group` is available). */
export function useWorkItem(
  projectId: string,
  id: string,
): UseQueryResult<WorkItem> {
  const client = usePlaneClient();
  return useQuery({
    queryKey: qk.workItem(projectId, id),
    enabled: !!projectId && !!id,
    queryFn: async () =>
      withProjectId(
        await client.getWorkItem(projectId, id, { expand: ["state"] }),
        projectId,
      ),
  });
}
