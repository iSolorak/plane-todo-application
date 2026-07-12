import type { WorkItem } from "@plane-todo/core";
import {
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { isDueByToday, todayLocalYmd } from "../lib/date";
import { usePlaneClient } from "./client";
import { isDone } from "./done";
import { withProjectId } from "./itemRefs";
import { qk } from "./queryKeys";

const TODAY_PER_PAGE = 100;
const ALL_PER_PAGE = 100;

/**
 * Today: work items across the given projects whose target_date is today or
 * earlier. Each project is fetched with `expand=state` (so done detection works
 * inline), then merged and filtered client-side. Sorting and done-filtering are
 * applied by the screen so the "Show done" toggle needs no refetch.
 */
export function useTodayItems(
  projectIds: string[],
): UseQueryResult<WorkItem[]> {
  const client = usePlaneClient();
  const today = todayLocalYmd();

  return useQuery({
    queryKey: qk.today(projectIds),
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        projectIds.map(async (projectId) => {
          const page = await client.listWorkItems(projectId, {
            expand: ["state"],
            per_page: TODAY_PER_PAGE,
            order_by: "target_date",
          });
          // Stamp the project id (some deployments omit `project_id` on items),
          // so row navigation and mutations can rely on item.project_id.
          return (page.results ?? []).map((item) => withProjectId(item, projectId));
        }),
      );
      return pages.flat().filter((item) => isDueByToday(item, today));
    },
  });
}

/**
 * All: work items across the selected projects. Plane pagination is per-project,
 * so the mobile All view walks each selected project's cursor pages and merges
 * them client-side, matching Today's multi-project pattern.
 */
export function useAllItems(projectIds: string[]): UseQueryResult<WorkItem[]> {
  const client = usePlaneClient();

  return useQuery({
    queryKey: qk.allItems(projectIds),
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        projectIds.map(async (projectId) => fetchAllProjectItems(projectId)),
      );
      return dedupeById(pages.flat()).sort(compareForAllView);
    },
  });

  async function fetchAllProjectItems(projectId: string): Promise<WorkItem[]> {
    const items: WorkItem[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listWorkItems(projectId, {
        expand: ["state"],
        per_page: ALL_PER_PAGE,
        order_by: "-created_at",
        cursor,
      });
      items.push(
        ...(page.results ?? []).map((item) => withProjectId(item, projectId)),
      );
      cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
    } while (cursor);
    return items;
  }
}

function dedupeById(items: WorkItem[]): WorkItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function compareForAllView(a: WorkItem, b: WorkItem): number {
  const doneDelta = Number(isDone(a)) - Number(isDone(b));
  if (doneDelta !== 0) return doneDelta;
  return (b.updated_at || b.created_at || "").localeCompare(
    a.updated_at || a.created_at || "",
  );
}
