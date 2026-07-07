import type { Offset } from "../config.js";
import type { ReminderRow, Store } from "../db.js";
import type { Senders } from "../senders/index.js";
import { resolveTargetInstant } from "../time.js";
import { dispatch } from "./dispatch.js";

export interface OffsetJobDeps {
  store: Store;
  offsets: Offset[];
  senders: Senders;
  /**
   * Timezone used to anchor date-only target_date values to end-of-day local
   * (config.digest.tz).
   */
  tz: string;
  /** Injected clock for testability. */
  now: Date;
  /**
   * When a missed offset's deadline is closer than this many minutes, drop it —
   * firing a "1d before" reminder for a task due in 10 minutes is noise. The
   * digest / imminence covers those. Defaults to 30.
   */
  minCatchupMinutes?: number;
}

const MINUTE_MS = 60_000;
export const DEFAULT_MIN_CATCHUP_MINUTES = 30;

/**
 * Decide whether a single (reminder, offset) is eligible to fire at `now`.
 *
 * Eligible when:
 *   now >= fireTime                          (offset window has opened)
 *   AND now < targetInstant                  (still before the deadline)
 *   AND (targetInstant - now) >= minCatchup  (deadline not basically-now)
 *
 * where `fireTime = targetInstant - minutesBefore`. The last clause gives
 * bounded catch-up: a task created after fireTime still fires once, as long as
 * it's meaningfully before the deadline. sent_log (checked by the caller)
 * enforces send-once — this function does not consult it.
 */
export function shouldFire(
  row: ReminderRow,
  offset: Offset,
  nowMs: number,
  tz: string,
  minCatchupMs: number,
): boolean {
  const targetInstant = resolveTargetInstant(row.target_date, tz);
  if (targetInstant === null) return false;

  const fireTime = targetInstant - offset.minutesBefore * MINUTE_MS;
  return (
    nowMs >= fireTime &&
    nowMs < targetInstant &&
    targetInstant - nowMs >= minCatchupMs
  );
}

/**
 * "Offset reminders" job (runs every 5 minutes). For each reminder with a
 * target_date and each configured offset, sends once when the offset is
 * eligible and the (work_item_id, offset_key) pair is not already in sent_log.
 */
export async function runOffsetReminders(deps: OffsetJobDeps): Promise<void> {
  const nowMs = deps.now.getTime();
  const minCatchupMs =
    (deps.minCatchupMinutes ?? DEFAULT_MIN_CATCHUP_MINUTES) * MINUTE_MS;
  const rows = deps.store.allWithTargetDate();

  for (const row of rows) {
    for (const offset of deps.offsets) {
      if (!shouldFire(row, offset, nowMs, deps.tz, minCatchupMs)) continue;
      if (deps.store.isSent(row.work_item_id, offset.key)) continue;

      await dispatch(deps.store, deps.senders, {
        title: `Reminder (${offset.key}): ${row.name}`,
        body: `Due ${row.target_date}. ${row.url}`,
        data: { workItemId: row.work_item_id, url: row.url, offset: offset.key },
      });

      // Mark sent AFTER dispatch (which is best-effort and never throws), so a
      // reminder is recorded once we've attempted delivery.
      deps.store.markSent(
        row.work_item_id,
        offset.key,
        new Date(nowMs).toISOString(),
      );
    }
  }
}
