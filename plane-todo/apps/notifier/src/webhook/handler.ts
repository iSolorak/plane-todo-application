import type { Store } from "../db.js";
import {
  buildReminderRow,
  projectIdOf,
  type IssueLike,
  type ReminderContext,
} from "../reminders.js";

export interface PlaneWebhookPayload {
  event?: string;
  action?: string;
  data?: IssueLike;
}

export interface HandlerContext extends ReminderContext {
  /** When non-empty, events for projects outside this set are ignored. */
  projectIds: string[];
}

export type HandlerResult =
  | { handled: false; reason: string }
  | { handled: true; op: "upsert" | "delete" };

/**
 * Apply a Plane webhook event to the reminders table.
 *
 * IMPORTANT: this NEVER sends notifications. Sending happens only in the cron
 * jobs, guarded by sent_log — that is the core idempotency guarantee. This
 * handler only mutates the reminders (and, on delete, sent_log) tables.
 */
export function handlePlaneWebhook(
  store: Store,
  payload: PlaneWebhookPayload,
  ctx: HandlerContext,
  now: Date = new Date(),
): HandlerResult {
  if (payload.event !== "issue") {
    return { handled: false, reason: `ignored event: ${payload.event}` };
  }

  const action = payload.action;
  const data = payload.data;
  if (!data || !data.id) {
    return { handled: false, reason: "missing data.id" };
  }

  // A "deleted" payload only carries { id } — remove the reminder and its
  // sent_log so a re-created id starts clean. No project filter possible here.
  if (action === "deleted") {
    store.deleteReminder(data.id);
    return { handled: true, op: "delete" };
  }

  if (action === "created" || action === "updated") {
    // Optional project scoping (deleted can't be scoped; created/updated can).
    const projectId = projectIdOf(data);
    if (
      ctx.projectIds.length > 0 &&
      projectId !== undefined &&
      !ctx.projectIds.includes(projectId)
    ) {
      return { handled: false, reason: `project not tracked: ${projectId}` };
    }

    // No target_date → nothing to remind about; ensure any prior row is gone.
    // (Adding an item to a module/cycle also arrives as "created"; upsert is
    // idempotent, so re-processing is harmless.)
    if (!data.target_date) {
      store.deleteReminder(data.id);
      return { handled: true, op: "delete" };
    }

    const row = buildReminderRow(data, ctx, now);
    if (!row) {
      // Missing project id despite having a target_date — can't build a URL/row.
      store.deleteReminder(data.id);
      return { handled: true, op: "delete" };
    }

    store.upsertReminder(row);
    return { handled: true, op: "upsert" };
  }

  return { handled: false, reason: `ignored action: ${action}` };
}
