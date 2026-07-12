import type {
  Priority,
  State,
  UpdateWorkItemInput,
  WorkItem,
} from "@plane-todo/core";
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { isDueByToday } from "../lib/date";
import {
  applyOptimisticInsert,
  applyOptimisticPatch,
  invalidateItemQueries,
  reconcileCreatedItem,
  rollback,
  type CacheSnapshot,
} from "./cache";
import { usePlaneClient } from "./client";
import { isDone } from "./done";
import { withProjectId } from "./itemRefs";
import { qk } from "./queryKeys";
import { pickCompleteState, pickReopenState } from "./states";
import { fetchStates, STATES_STALE_TIME_MS, useStates } from "./useStates";

// -----------------------------------------------------------------------------
// Field edits (target_date / priority) — optimistic PATCH
// -----------------------------------------------------------------------------

export interface WorkItemFieldPatch {
  target_date?: string | null;
  priority?: Priority;
  description_html?: string | null;
}

export interface FieldEditVars {
  id: string;
  patch: WorkItemFieldPatch;
}

export function useUpdateWorkItemFields(
  projectId: string,
): UseMutationResult<WorkItem, Error, FieldEditVars, CacheSnapshot> {
  const client = usePlaneClient();
  const qc = useQueryClient();

  return useMutation<WorkItem, Error, FieldEditVars, CacheSnapshot>({
    mutationFn: ({ id, patch }) =>
      client.updateWorkItem(projectId, id, patch as UpdateWorkItemInput),
    onMutate: ({ id, patch }) =>
      applyOptimisticPatch(qc, projectId, id, (item) => ({ ...item, ...patch })),
    onError: (_err, _vars, ctx) => {
      if (ctx) rollback(qc, ctx);
    },
    onSettled: (_data, _err, vars) =>
      invalidateItemQueries(qc, projectId, vars.id),
  });
}

// -----------------------------------------------------------------------------
// Done toggle — optimistic state change (flips isDone via the expanded state)
// -----------------------------------------------------------------------------

function useSetDone(
  projectId: string,
  pick: (states: State[]) => State | undefined,
  label: string,
): UseMutationResult<WorkItem, Error, WorkItem, CacheSnapshot> {
  const client = usePlaneClient();
  const qc = useQueryClient();
  const { data: states } = useStates(projectId);

  return useMutation<WorkItem, Error, WorkItem, CacheSnapshot>({
    mutationFn: (item) => {
      const target = states ? pick(states) : undefined;
      if (!target) {
        throw new Error(`No ${label} state configured for this project.`);
      }
      return client.updateWorkItem(projectId, item.id, { state: target.id });
    },
    onMutate: (item) => {
      const target = states ? pick(states) : undefined;
      // Set the expanded state object so isDone() flips immediately.
      return applyOptimisticPatch(qc, projectId, item.id, (i) =>
        target ? { ...i, state: target } : i,
      );
    },
    onError: (_err, _item, ctx) => {
      if (ctx) rollback(qc, ctx);
    },
    onSettled: (_data, _err, item) =>
      invalidateItemQueries(qc, projectId, item.id),
  });
}

/** Mark done: move to the project's completed state (default ?? lowest seq). */
export function useCompleteItem(projectId: string) {
  return useSetDone(projectId, pickCompleteState, "completed");
}

/** Reopen: move back to the project's default (?? first unstarted) state. */
export function useReopenItem(projectId: string) {
  return useSetDone(projectId, pickReopenState, "reopen");
}

/**
 * Toggle done for an item from any project (Today spans projects). Resolves the
 * item's project states on demand, picks complete-vs-reopen from its current
 * done state, and updates optimistically.
 */
export function useToggleDone(): UseMutationResult<
  WorkItem,
  Error,
  WorkItem,
  CacheSnapshot
> {
  const client = usePlaneClient();
  const qc = useQueryClient();

  return useMutation<WorkItem, Error, WorkItem, CacheSnapshot>({
    mutationFn: async (item) => {
      const states = await qc.ensureQueryData({
        queryKey: qk.states(item.project_id),
        queryFn: () => fetchStates(client, item.project_id),
        staleTime: STATES_STALE_TIME_MS,
      });
      const currentlyDone = isDone(item);
      const target = currentlyDone
        ? pickReopenState(states)
        : pickCompleteState(states);
      if (!target) {
        throw new Error(
          currentlyDone
            ? "No reopen state configured for this project."
            : "No completed state configured for this project.",
        );
      }
      return client.updateWorkItem(item.project_id, item.id, {
        state: target.id,
      });
    },
    onMutate: (item) => {
      const states = qc.getQueryData<State[]>(qk.states(item.project_id));
      const currentlyDone = isDone(item);
      const target = states
        ? currentlyDone
          ? pickReopenState(states)
          : pickCompleteState(states)
        : undefined;
      return applyOptimisticPatch(qc, item.project_id, item.id, (i) =>
        target ? { ...i, state: target } : i,
      );
    },
    onError: (_err, _item, ctx) => {
      if (ctx) rollback(qc, ctx);
    },
    onSettled: (_data, _err, item) =>
      invalidateItemQueries(qc, item.project_id, item.id),
  });
}

// -----------------------------------------------------------------------------
// Create — optimistic insert
// -----------------------------------------------------------------------------

export interface CreateWorkItemForm {
  name: string;
  description_html?: string | null;
  priority: Priority;
  target_date: string | null;
}

export function useCreateItem(
  projectId: string,
): UseMutationResult<WorkItem, Error, CreateWorkItemForm, CacheSnapshot> {
  const client = usePlaneClient();
  const qc = useQueryClient();

  return useMutation<WorkItem, Error, CreateWorkItemForm, CacheSnapshot>({
    mutationFn: (form) =>
      client.createWorkItem(projectId, {
        name: form.name,
        description_html: form.description_html ?? null,
        priority: form.priority,
        target_date: form.target_date,
      }),
    onMutate: (form) => {
      const now = new Date().toISOString();
      const temp: WorkItem = {
        id: `temp-${Date.now()}`,
        name: form.name,
        description_html: form.description_html ?? null,
        sequence_id: 0,
        state: null,
        priority: form.priority,
        assignees: [],
        labels: [],
        start_date: null,
        target_date: form.target_date,
        project_id: projectId,
        created_at: now,
        updated_at: now,
      };
      return applyOptimisticInsert(qc, projectId, temp, isDueByToday(temp));
    },
    onError: (_err, _form, ctx) => {
      if (ctx) rollback(qc, ctx);
    },
    onSuccess: (created, _form, ctx) => {
      const item = withProjectId(created, projectId);
      reconcileCreatedItem(qc, projectId, ctx?.tempId, item, isDueByToday(item));
    },
    onSettled: () => invalidateItemQueries(qc, projectId),
  });
}
