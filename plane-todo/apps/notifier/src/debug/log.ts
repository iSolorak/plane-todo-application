/**
 * Tiny in-memory ring buffer for same-day-decision breadcrumbs.
 * Exposed via GET /debug/same-day-log so you can diagnose "why didn't a
 * notification fire?" without SSH'ing to the notifier and grepping stderr.
 * Lost on process restart — that's fine, it's a live-debug aid, not history.
 */

const CAPACITY = 50;

export interface SameDayLogEntry {
  at: string; // ISO timestamp of the decision
  workItemId: string;
  name: string;
  target_date: string | null;
  todayYmd: string; // what the notifier considered "today" (in env.tz)
  tz: string;
  outcome:
    | { kind: "skipped"; reason: string }
    | {
        kind: "dispatched";
        tokenCount: number;
        pushAttempted: number;
        pushAccepted: number;
        invalidTokens: number;
        ticketErrors: string[];
        chunkErrors: string[];
        marked: boolean;
      };
}

const buffer: SameDayLogEntry[] = [];

export function recordSameDay(entry: SameDayLogEntry): void {
  buffer.push(entry);
  if (buffer.length > CAPACITY) buffer.splice(0, buffer.length - CAPACITY);
}

/** Newest-first, up to `n` entries. */
export function readSameDayLog(n: number = CAPACITY): SameDayLogEntry[] {
  return buffer.slice(-n).reverse();
}
