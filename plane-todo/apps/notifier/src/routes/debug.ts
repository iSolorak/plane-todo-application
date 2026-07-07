import type { FastifyInstance } from "fastify";
import type { Store } from "../db.js";

export interface DebugRouteDeps {
  store: Store;
}

/**
 * Non-production debug endpoints. Mounted only when NODE_ENV !== "production"
 * (see server.ts). Read-only — exposes the current mirror state so you can
 * confirm what the webhook has stored without opening the SQLite file.
 */
export function registerDebugRoutes(
  app: FastifyInstance,
  deps: DebugRouteDeps,
): void {
  app.get("/debug/reminders", async () => deps.store.listReminders());
}
