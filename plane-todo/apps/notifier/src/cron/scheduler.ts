import cron from "node-cron";
import type { AppEnv, ReminderConfig } from "../config.js";
import type { Store } from "../db.js";
import type { Senders } from "../senders/index.js";
import { runDigest } from "./digest.js";
import { runOffsetReminders } from "./offsets.js";

export interface SchedulerDeps {
  store: Store;
  config: ReminderConfig;
  senders: Senders;
  env: AppEnv;
}

/** Convert "HH:mm" into a node-cron "m h * * *" expression. */
function dailyCron(time: string): string {
  const [h, m] = time.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`Invalid digest time: "${time}" (expected HH:mm).`);
  }
  return `${m} ${h} * * *`;
}

/**
 * Register the two cron jobs. Job bodies are wrapped so a thrown error is
 * logged rather than propagated (a rejected async cron callback would otherwise
 * be an unhandled rejection).
 */
export function startCron(deps: SchedulerDeps): void {
  const { store, config, senders, env } = deps;

  // Offset reminders — every 5 minutes, in the service timezone.
  cron.schedule(
    "*/5 * * * *",
    () => {
      runOffsetReminders({
        store,
        offsets: config.offsets,
        senders,
        // Anchor date-only target_date to end-of-day in the digest timezone.
        tz: config.digest.tz,
        now: new Date(),
        minCatchupMinutes: config.minCatchupMinutes,
      }).catch((err) => console.error("[cron] offset reminders failed:", err));
    },
    { timezone: env.tz },
  );

  // Daily digest — at config.digest.time in config.digest.tz.
  if (config.digest.enabled) {
    cron.schedule(
      dailyCron(config.digest.time),
      () => {
        runDigest({
          store,
          senders,
          now: new Date(),
          tz: config.digest.tz,
        }).catch((err) => console.error("[cron] digest failed:", err));
      },
      { timezone: config.digest.tz },
    );
    console.log(
      `[cron] digest scheduled at ${config.digest.time} ${config.digest.tz}`,
    );
  }

  console.log("[cron] offset reminders scheduled every 5 minutes");
}
