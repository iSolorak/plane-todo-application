import { PlaneClient } from "@plane-todo/core";
import type { AppEnv } from "./config.js";
import type { Store } from "./db.js";
import { buildReminderRow, type ReminderContext } from "./reminders.js";

export function createPlaneClient(env: AppEnv): PlaneClient {
  return new PlaneClient({
    baseUrl: env.planeBaseUrl,
    workspaceSlug: env.planeWorkspaceSlug,
    auth: { type: "apiKey", apiKey: env.planeApiKey },
  });
}

/**
 * Initial reconciliation on boot: page through every configured project's work
 * items and upsert reminders for those with a target_date. Complements the
 * webhook (which only sees changes made after subscription). Best-effort — a
 * failure here is logged, not fatal.
 */
export async function syncProjectReminders(
  client: PlaneClient,
  store: Store,
  env: AppEnv,
): Promise<void> {
  const ctx: ReminderContext = {
    baseUrl: env.planeBaseUrl,
    workspaceSlug: env.planeWorkspaceSlug,
  };

  for (const projectId of env.planeProjectIds) {
    let cursor: string | undefined;
    do {
      const page = await client.listWorkItems(projectId, {
        per_page: 100,
        cursor,
      });
      for (const item of page.results) {
        if (!item.target_date) continue;
        const row = buildReminderRow(
          {
            id: item.id,
            name: item.name,
            project_id: item.project_id,
            target_date: item.target_date,
          },
          ctx,
        );
        if (row) store.upsertReminder(row);
      }
      cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
    } while (cursor);
  }
}
