import type { WorkItem } from "@plane-todo/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { DailyTaskList } from "../../src/components/DailyTaskList";
import { Fab } from "../../src/components/Fab";
import {
  ErrorState,
  Loading,
  Screen,
} from "../../src/components/ui";
import { useConfig } from "../../src/data/config";
import { toUserFacingError } from "../../src/data/errors";
import { selectTodayProjectIds } from "../../src/data/projects";
import { useToggleDone } from "../../src/data/useItemMutations";
import { useProjects } from "../../src/data/useProjects";
import { useTodayItems } from "../../src/data/useWorkItems";
import { sortByTargetThenPriority } from "../../src/lib/date";
import { countDone, filterItems } from "../../src/lib/filterItems";
import { useUnauthorizedRedirect } from "../../src/native/useUnauthorizedRedirect";

export default function TodayScreen() {
  const router = useRouter();
  const { config } = useConfig();
  const [showDone, setShowDone] = useState(false);

  // useProjects guarantees `projects` is always a Project[] — never undefined,
  // never the paginated wrapper.
  const projectsQuery = useProjects();
  const projectIds = selectTodayProjectIds(
    projectsQuery.projects,
    config?.defaultProjectId,
  );

  const today = useTodayItems(projectIds);
  const toggle = useToggleDone();
  useUnauthorizedRedirect(today.error ?? projectsQuery.error);

  const items = today.data ?? [];
  const visible = useMemo(
    () => sortByTargetThenPriority(filterItems(items, { showDone })),
    [items, showDone],
  );
  const hiddenDone = useMemo(() => countDone(items), [items]);

  const openItem = (item: WorkItem) =>
    router.push({
      pathname: "/item/[id]",
      params: { id: item.id, projectId: item.project_id },
    });

  // While the projects query is pending (and no default project short-circuits
  // it), we don't yet know which projects Today spans — show loading rather
  // than computing on absent data.
  const projectsPending = projectsQuery.isPending && !config?.defaultProjectId;
  if (today.isLoading || projectsPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (projectsQuery.isError && !config?.defaultProjectId) {
    return (
      <Screen>
        <ErrorState
          message={toUserFacingError(projectsQuery.error).message}
          onRetry={() => projectsQuery.refetch()}
        />
      </Screen>
    );
  }
  if (today.isError) {
    return (
      <Screen>
        <ErrorState
          message={toUserFacingError(today.error).message}
          onRetry={() => today.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <DailyTaskList
        title="Today"
        items={visible}
        totalCount={items.length}
        hiddenDone={hiddenDone}
        showDone={showDone}
        onShowDoneChange={setShowDone}
        refreshing={today.isRefetching}
        onRefresh={() => today.refetch()}
        onPressItem={openItem}
        onToggleDone={(i) => toggle.mutate(i)}
        isItemBusy={(item) => toggle.isPending && toggle.variables?.id === item.id}
        emptyMessage={showDone ? "Nothing due today." : "Nothing active due today."}
      />
      <Fab onPress={() => router.push("/item/new")} />
    </Screen>
  );
}
