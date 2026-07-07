import "dotenv/config";
import { loadEnv, loadReminderConfig } from "./config.js";
import { startCron } from "./cron/scheduler.js";
import { openDb, Store } from "./db.js";
import { createSenders } from "./senders/index.js";
import { buildServer } from "./server.js";
import { createPlaneClient, syncProjectReminders } from "./sync.js";

async function main(): Promise<void> {
  // Fail fast on missing/invalid configuration.
  const env = loadEnv(process.env);
  const config = loadReminderConfig(env.configPath);

  const db = openDb(env.dbPath); // runs idempotent migrations
  const store = new Store(db);
  const senders = createSenders(env);

  const app = buildServer({ store, env });
  await app.listen({ host: "0.0.0.0", port: env.port });
  console.log(`[notifier] listening on :${env.port} (tz=${env.tz})`);

  // Best-effort initial reconciliation from the Plane API.
  const client = createPlaneClient(env);
  syncProjectReminders(client, store, env)
    .then(() => console.log("[sync] initial reminder sync complete"))
    .catch((err) => console.error("[sync] initial sync failed:", err));

  startCron({ store, config, senders, env });

  const shutdown = async () => {
    console.log("[notifier] shutting down…");
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[notifier] fatal:", err);
  process.exit(1);
});
