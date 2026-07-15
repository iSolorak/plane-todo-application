import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config.js";
import { dispatch } from "../cron/dispatch.js";
import { maybeSendSameDay } from "../cron/sameDay.js";
import type { Store } from "../db.js";
import type { Senders } from "../senders/index.js";

export interface DebugRouteDeps {
  store: Store;
  env?: AppEnv;
  senders?: Senders;
}

/**
 * Non-production debug endpoints. Mounted only when NODE_ENV !== "production"
 * (see server.ts). Read-only unless explicitly stated on the endpoint.
 *
 * These endpoints are what you `curl` from your laptop when a notification
 * silently didn't fire — they surface every reason the pipeline could have
 * bailed (0 devices, tz mismatch, Expo rejected token, chunk send failed…).
 */
export function registerDebugRoutes(
  app: FastifyInstance,
  deps: DebugRouteDeps,
): void {
  // A ping to confirm you actually redeployed. Bump when you add endpoints so
  // it's obvious from `curl` alone whether the running notifier is stale.
  app.get("/debug/version", async () => ({
    api: 2,
    endpoints: [
      "GET  /debug/version",
      "GET  /debug/reminders",
      "GET  /debug/devices",
      "GET  /debug/tokens",
      "POST /debug/same-day",
      "POST /debug/push-test",
    ],
  }));

  app.get("/debug/reminders", async () => deps.store.listReminders());

  // Redacted count/preview — useful for quick "is the token there?" checks.
  app.get("/debug/devices", async () => {
    const tokens = deps.store.listDeviceTokens();
    return {
      count: tokens.length,
      preview: tokens.map((t) => t.slice(0, 24) + "…"),
    };
  });

  // Full tokens, as requested. Only mounted in non-production; still keep this
  // notifier behind auth (VPN, Cloudflare Access, etc.) in real deployments.
  app.get("/debug/tokens", async () => {
    const tokens = deps.store.listDeviceTokens();
    return { count: tokens.length, tokens };
  });

  // Force a same-day push for a given work item — runs the exact same code
  // path a webhook would, so you can prove the pipeline without touching Plane.
  // POST /debug/same-day { "workItemId": "<uuid>" }.
  app.post("/debug/same-day", async (req, reply) => {
    if (!deps.senders || !deps.env) {
      return reply.code(503).send({ error: "senders/env not wired" });
    }
    const workItemId = (req.body as { workItemId?: string } | null)?.workItemId;
    if (!workItemId) return reply.code(400).send({ error: "workItemId required" });

    const row = deps.store
      .allWithTargetDate()
      .find((r) => r.work_item_id === workItemId);
    if (!row) return reply.code(404).send({ error: "no reminder with a target_date for that id" });

    const result = await maybeSendSameDay(row, {
      store: deps.store,
      senders: deps.senders,
      now: new Date(),
      tz: deps.env.tz,
    });
    return { attempted: true, result };
  });

  // Bypass every guard and push a hardcoded message to all registered devices.
  // Confirms the token → Expo → FCM path in isolation. POST /debug/push-test.
  app.post("/debug/push-test", async () => {
    if (!deps.senders) return { ok: false, reason: "senders not wired" };
    const result = await dispatch(deps.store, deps.senders, {
      title: "Notifier push test",
      body: "If you see this, tokens + Expo + FCM are wired correctly.",
      data: { kind: "debug" },
    });
    return { ok: true, result };
  });
}
