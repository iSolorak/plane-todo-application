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

/** ---------------------------------------------------------------------------
 * Webhook breadcrumbs — one entry per POST /webhooks/plane so you can see
 * whether Plane is even reaching the notifier, and if so what the handler
 * decided. Also lost on restart.
 * ------------------------------------------------------------------------- */

export interface WebhookLogEntry {
  at: string;
  event?: string;
  action?: string;
  workItemId?: string;
  projectId?: string;
  hasTargetDate: boolean;
  targetDate: string | null;
  signatureOk: boolean;
  deliveryId?: string;
  /** Detected redeliveries by delivery id. */
  deduped: boolean;
  /** Coarse handler result. */
  handled: boolean;
  op?: "upsert" | "delete";
  handlerReason?: string;
  /** Did we invoke same-day? If not, why? */
  sameDayInvoked: boolean;
  sameDaySkipReason?: string;
  /** Top-level keys present on payload.data (for shape debugging). */
  payloadDataKeys: string[];
}

const webhookBuffer: WebhookLogEntry[] = [];

export function recordWebhook(entry: WebhookLogEntry): void {
  webhookBuffer.push(entry);
  if (webhookBuffer.length > CAPACITY) {
    webhookBuffer.splice(0, webhookBuffer.length - CAPACITY);
  }
}

export function readWebhookLog(n: number = CAPACITY): WebhookLogEntry[] {
  return webhookBuffer.slice(-n).reverse();
}
