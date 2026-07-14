import type { ReminderRow } from "../db.js";
import type { Store } from "../db.js";
import type { Senders } from "../senders/index.js";
import { dispatch } from "./dispatch.js";
import { ymdInTz } from "./digest.js";

/** offsetKey prefix used to guard the same-day notification in sent_log. */
export const SAME_DAY_PREFIX = "same-day";

export interface SameDayDeps {
  store: Store;
  senders: Senders;
  now: Date;
  /** IANA timezone used to resolve "today". */
  tz: string;
}

/**
 * Send a "due today" push the moment a webhook confirms an item's `target_date`
 * equals today (in the configured tz). Guarded by sent_log with a
 * `same-day:<YYYY-MM-DD>` offsetKey so it fires at most once per item per day,
 * even if Plane redelivers the same event or the user toggles the date. If the
 * target_date is later moved to a different day, that new day gets its own key
 * and can fire again.
 *
 * Never throws — best-effort like all other sends.
 */
export async function maybeSendSameDay(
  row: ReminderRow,
  deps: SameDayDeps,
): Promise<boolean> {
  if (!row.target_date) return false;

  const today = ymdInTz(deps.now, deps.tz);
  // target_date may be a full ISO timestamp; compare date part only.
  if (row.target_date.slice(0, 10) !== today) return false;

  const offsetKey = `${SAME_DAY_PREFIX}:${today}`;
  if (deps.store.isSent(row.work_item_id, offsetKey)) return false;

  await dispatch(deps.store, deps.senders, {
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

  deps.store.markSent(row.work_item_id, offsetKey, deps.now.toISOString());
  return true;
}
