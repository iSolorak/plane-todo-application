import type { FastifyInstance } from "fastify";
import type { ReminderConfig } from "../config.js";

export interface ConfigRouteDeps {
  reminderConfig: ReminderConfig;
}

/**
 * Read-only view of the reminder schedule (offsets + digest), consumed by the
 * mobile Settings screen. Contains no secrets. Editing is not supported.
 */
export function registerConfigRoute(
  app: FastifyInstance,
  deps: ConfigRouteDeps,
): void {
  app.get("/config", async () => ({
    offsets: deps.reminderConfig.offsets,
    digest: deps.reminderConfig.digest,
    minCatchupMinutes: deps.reminderConfig.minCatchupMinutes,
  }));
}
