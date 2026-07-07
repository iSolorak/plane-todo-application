import type { Store } from "../db.js";
import type { Senders } from "../senders/index.js";
import { dispatch } from "./dispatch.js";

export interface DigestJobDeps {
  store: Store;
  senders: Senders;
  now: Date;
  /** Timezone used to resolve "today". */
  tz: string;
}

/** Sentinel work_item_id used to guard the once-per-day digest in sent_log. */
const DIGEST_SENTINEL = "__digest__";

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function ymdInTz(date: Date, tz: string): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * "Digest" job (runs once daily). Collects reminders due today and sends ONE
 * push + ONE email summarizing them. Idempotent via a sent_log row keyed
 * `digest:<YYYY-MM-DD>` on a sentinel work item, so re-runs on the same day
 * (e.g. a restart) don't re-send.
 */
export async function runDigest(deps: DigestJobDeps): Promise<void> {
  const ymd = ymdInTz(deps.now, deps.tz);
  const offsetKey = `digest:${ymd}`;

  if (deps.store.isSent(DIGEST_SENTINEL, offsetKey)) return;

  const rows = deps.store.dueOn(ymd);
  if (rows.length === 0) return;

  const lines = rows.map((r) => `• ${r.name} — ${r.url}`);
  const title = `Today's Plane items (${rows.length})`;
  const body = `${rows.length} item(s) due ${ymd}:\n${lines.join("\n")}`;

  await dispatch(deps.store, deps.senders, {
    title,
    body,
    data: { kind: "digest", date: ymd, count: rows.length },
  });

  deps.store.markSent(DIGEST_SENTINEL, offsetKey, deps.now.toISOString());
}
