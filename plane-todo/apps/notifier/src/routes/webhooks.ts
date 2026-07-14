import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config.js";
import { maybeSendSameDay } from "../cron/sameDay.js";
import type { Store } from "../db.js";
import { buildReminderRow } from "../reminders.js";
import type { Senders } from "../senders/index.js";
import type { LruSet } from "../webhook/dedup.js";
import {
  handlePlaneWebhook,
  type HandlerResult,
  type PlaneWebhookPayload,
} from "../webhook/handler.js";
import { verifySignature } from "../webhook/verify.js";

export interface WebhookRouteDeps {
  store: Store;
  env: AppEnv;
  dedup: LruSet;
  /**
   * When provided, upserts whose new target_date equals today (in env.tz)
   * trigger a best-effort "due today" push. Omitted by tests that only exercise
   * the handler's mirroring semantics.
   */
  senders?: Senders;
}

export function registerWebhookRoute(
  app: FastifyInstance,
  deps: WebhookRouteDeps,
): void {
  app.post("/webhooks/plane", async (req, reply) => {
    const raw = req.rawBody ?? Buffer.alloc(0);
    const signature = headerValue(req.headers["x-plane-signature"]);
    const delivery = headerValue(req.headers["x-plane-delivery"]);

    if (!verifySignature(raw, deps.env.planeWebhookSecret, signature)) {
      console.warn(
        `[webhook] rejected: invalid signature (delivery=${delivery ?? "?"})`,
      );
      return reply.code(401).send({ error: "invalid signature" });
    }

    // Dedupe redelivered webhooks by delivery id (idempotent no-op if seen).
    if (delivery && !deps.dedup.add(delivery)) {
      console.log(`[webhook] duplicate delivery ${delivery} — skipped`);
      return reply.send({ ok: true, deduped: true });
    }

    const payload = (req.body ?? {}) as PlaneWebhookPayload;
    const ctx = {
      projectIds: deps.env.planeProjectIds,
      baseUrl: deps.env.planeBaseUrl,
      workspaceSlug: deps.env.planeWorkspaceSlug,
    };
    const result = handlePlaneWebhook(deps.store, payload, ctx);

    logOutcome(payload, result);

    // Same-day push: when the upserted row's target_date == today, fire a
    // one-shot notification. Guarded by sent_log inside maybeSendSameDay so a
    // second event on the same day for the same item is a no-op.
    if (result.handled && result.op === "upsert" && deps.senders && payload.data) {
      const row = buildReminderRow(payload.data, ctx);
      if (row) {
        maybeSendSameDay(row, {
          store: deps.store,
          senders: deps.senders,
          now: new Date(),
          tz: deps.env.tz,
        }).catch((err) => {
          console.error("[webhook] same-day send failed:", err);
        });
      }
    }

    return reply.send({ ok: true, ...result });
  });
}

/**
 * Emit one concise line describing what the delivery did. Only the fields below
 * are logged — never the raw body, headers, secret, or full payload.
 */
function logOutcome(payload: PlaneWebhookPayload, result: HandlerResult): void {
  if (payload.event !== "issue") {
    console.log(
      `[webhook] ignored event=${payload.event} action=${payload.action}`,
    );
    return;
  }

  if (!result.handled) return; // other no-ops (untracked project, etc.) stay quiet

  const data = payload.data;
  if (result.op === "upsert") {
    console.log(
      `[webhook] issue ${payload.action} ${data?.id} "${data?.name ?? ""}" ` +
        `target_date=${data?.target_date ?? "none"} → mirror upserted`,
    );
  } else {
    console.log(
      `[webhook] issue ${payload.action} ${data?.id} → mirror row removed`,
    );
  }
}

function headerValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
