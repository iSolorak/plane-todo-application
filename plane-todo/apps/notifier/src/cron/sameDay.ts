import type { ReminderRow } from "../db.js";
import type { Store } from "../db.js";
import { recordSameDay } from "../debug/log.js";
import type { Senders } from "../senders/index.js";
import { dispatch, type DispatchResult } from "./dispatch.js";
import { ymdInTz } from "./digest.js";

/** offsetKey prefix used to guard the same-day notification in sent_log. */
export const SAME_DAY_PREFIX = "same-day";

export interface SameDayDeps {
  store: Store;
  senders: Senders;
  now: Date;
  /** IANA timezone used to resolve "today". */
  tz: string;
  /**
   * The item's `target_date` as it was stored BEFORE this webhook's upsert
   * (undefined = the item didn't exist yet, i.e. a fresh create). Enables
   * transition detection: fire on any change TO today, skip when today → today
   * (an unrelated field edit) so we don't spam.
   */
  previousTargetDate?: string | null;
}

export type SameDayResult =
  | { sent: false; reason: string }
  | { sent: true; dispatch: DispatchResult };

/**
 * Send a "due today" push the moment a webhook confirms an item's `target_date`
 * equals today (in the configured tz). Guarded by sent_log with a
 * `same-day:<YYYY-MM-DD>` offsetKey so it fires at most once per item per day,
 * even if Plane redelivers the same event or the user toggles the date. If the
 * target_date is later moved to a different day, that new day gets its own key
 * and can fire again.
 *
 * Never throws. Returns a structured result AND appends a breadcrumb to the
 * debug ring-buffer so `GET /debug/same-day-log` can show exactly what
 * happened when a push silently didn't fire.
 */
export async function maybeSendSameDay(
  row: ReminderRow,
  deps: SameDayDeps,
): Promise<SameDayResult> {
  const at = deps.now.toISOString();
  const today = row.target_date ? ymdInTz(deps.now, deps.tz) : "n/a";

  const skip = (reason: string): SameDayResult => {
    console.log(`[same-day] skip: ${reason}`);
    recordSameDay({
      at,
      workItemId: row.work_item_id,
      name: row.name,
      target_date: row.target_date,
      todayYmd: today,
      tz: deps.tz,
      outcome: { kind: "skipped", reason },
    });
    return { sent: false, reason };
  };

  if (!row.target_date) return skip(`no target_date on ${row.work_item_id}`);

  const rowYmd = row.target_date.slice(0, 10);
  if (rowYmd !== today) {
    return skip(`target_date ${rowYmd} != today ${today} (tz=${deps.tz})`);
  }

  // Transition detection: only fire when this webhook is what MOVED the item
  // into "due today" (either from a different date, or first-time create).
  // A webhook that leaves target_date at today (e.g. a label/description edit)
  // must NOT re-notify. `previousTargetDate === undefined` means the item is
  // brand new — treat as a transition and fire.
  const prevYmd = deps.previousTargetDate?.slice(0, 10);
  const wasAlreadyToday = prevYmd === today;
  if (wasAlreadyToday) {
    return skip(
      `no transition: item was already due today before this webhook (prev=${prevYmd})`,
    );
  }

  // Real transition to today — clear any stale sent_log so we can fire even if
  // an earlier "due today" cycle for this item was recorded (e.g. user moved
  // date away then back). This is what makes "notify on change" work.
  deps.store.clearSentForItem(row.work_item_id);

  const offsetKey = `${SAME_DAY_PREFIX}:${today}`;
  if (deps.store.isSent(row.work_item_id, offsetKey)) {
    // Defensive: shouldn't be reachable given clearSentForItem above, but keep
    // as a last-line duplicate-delivery guard.
    return skip(`already sent for ${row.work_item_id} today (${offsetKey})`);
  }

  const tokenCount = deps.store.listDeviceTokens().length;
  console.log(
    `[same-day] dispatching "${row.name}" (${row.work_item_id}) to ${tokenCount} device(s)`,
  );

  const result = await dispatch(deps.store, deps.senders, {
    title: `Due today: ${row.name}`,
    body: row.url,
    data: {
      kind: "same-day",
      workItemId: row.work_item_id,
      projectId: row.project_id,
      url: row.url,
      date: today,
    },
  });

  // Only mark sent when a push was actually accepted by Expo — otherwise a
  // retry on the next webhook (or debug trigger) will have another chance.
  const anythingDelivered = (result.push?.accepted ?? 0) > 0;
  if (anythingDelivered) {
    deps.store.markSent(row.work_item_id, offsetKey, deps.now.toISOString());
    console.log(
      `[same-day] sent + marked ${row.work_item_id} @ ${offsetKey} (accepted=${result.push?.accepted})`,
    );
  } else {
    console.log(
      `[same-day] NOT marking sent — 0 pushes accepted ` +
        `(tokens=${result.tokenCount}, invalid=${result.push?.invalidTokens.length ?? 0}, ` +
        `ticketErrors=${result.push?.ticketErrors.length ?? 0}, chunkErrors=${result.push?.chunkErrors.length ?? 0})`,
    );
  }

  recordSameDay({
    at,
    workItemId: row.work_item_id,
    name: row.name,
    target_date: row.target_date,
    todayYmd: today,
    tz: deps.tz,
    outcome: {
      kind: "dispatched",
      tokenCount: result.tokenCount,
      pushAttempted: result.push?.attempted ?? 0,
      pushAccepted: result.push?.accepted ?? 0,
      invalidTokens: result.push?.invalidTokens.length ?? 0,
      ticketErrors: result.push?.ticketErrors ?? [],
      chunkErrors: result.push?.chunkErrors ?? [],
      marked: anythingDelivered,
    },
  });

  return { sent: true, dispatch: result };
}
