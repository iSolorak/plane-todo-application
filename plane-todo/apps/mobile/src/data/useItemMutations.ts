import type { State, WorkItem } from "@plane-todo/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { usePlaneClient } from "./client";
import { qk } from "./queryKeys";
import { pickCompleteState, pickReopenState } from "./states";
import { useStates } from "./useStates";

/**
 * Given the project's states and a chooser, resolve the target state id or
 * throw a clear error. Kept separate so the choice is easy to reason about and
 * to unit-test alongside {@link pickCompleteState}/{@link pickReopenState}.
 */
function resolveTargetStateId(
  states: State[] | undefined,
  pick: (states: State[]) => State | undefined,
  label: string,
): string {
  const target = states ? pick(states) : undefined;
  if (!target) {
    throw new Error(`No ${label} state configured for this project.`);
  }
  return target.id;
}

/** Mark a work item done by moving it to the project's completed state. */
export function useCompleteItem(
  projectId: string,
): UseMutationResult<WorkItem, Error, WorkItem> {
  const client = usePlaneClient();
  const qc = useQueryClient();
  const { data: states } = useStates(projectId);

  return useMutation({
    mutationFn: (item: WorkItem) => {
      const stateId = resolveTargetStateId(states, pickCompleteState, "completed");
      return client.updateWorkItem(projectId, item.id, { state: stateId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.workItems(projectId) });
    },
  });
}

/** Reopen a done work item by moving it back to the project's default state. */
export function useReopenItem(
  projectId: string,
): UseMutationResult<WorkItem, Error, WorkItem> {
  const client = usePlaneClient();
  const qc = useQueryClient();
  const { data: states } = useStates(projectId);

  return useMutation({
    mutationFn: (item: WorkItem) => {
      const stateId = resolveTargetStateId(states, pickReopenState, "reopen");
      return client.updateWorkItem(projectId, item.id, { state: stateId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.workItems(projectId) });
    },
  });
}
