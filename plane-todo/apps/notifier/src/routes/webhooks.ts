import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config.js";
import { maybeSendSameDay } from "../cron/sameDay.js";
import type { Store } from "../db.js";
import { recordWebhook } from "../debug/log.js";
import { buildReminderRow, projectIdOf } from "../reminders.js";
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
    const at = new Date().toISOString();
    const raw = req.rawBody ?? Buffer.alloc(0);
    const signature = headerValue(req.headers["x-plane-signature"]);
    const delivery = headerValue(req.headers["x-plane-delivery"]);

    if (!verifySignature(raw, deps.env.planeWebhookSecret, signature)) {
      console.warn(
        `[webhook] rejected: invalid signature (delivery=${delivery ?? "?"})`,
      );
      recordWebhook({
        at,
        signatureOk: false,
        deliveryId: delivery,
        deduped: false,
        handled: false,
        handlerReason: "invalid signature",
        hasTargetDate: false,
        targetDate: null,
        sameDayInvoked: false,
        payloadDataKeys: [],
      });
      return reply.code(401).send({ error: "invalid signature" });
    }

    // Dedupe redelivered webhooks by delivery id (idempotent no-op if seen).
    if (delivery && !deps.dedup.add(delivery)) {
      console.log(`[webhook] duplicate delivery ${delivery} — skipped`);
      recordWebhook({
        at,
        signatureOk: true,
        deliveryId: delivery,
        deduped: true,
        handled: false,
        handlerReason: "deduped",
        hasTargetDate: false,
        targetDate: null,
        sameDayInvoked: false,
        payloadDataKeys: [],
      });
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
    let sameDayInvoked = false;
    let sameDaySkipReason: string | undefined;
    if (result.handled && result.op === "upsert") {
      if (!deps.senders) {
        sameDaySkipReason = "senders not wired in server (redeploy notifier)";
        console.log(`[same-day] skip: ${sameDaySkipReason}`);
      } else if (!payload.data) {
        sameDaySkipReason = "no payload.data";
        console.log(`[same-day] skip: ${sameDaySkipReason}`);
      } else {
        const row = buildReminderRow(payload.data, ctx);
        if (!row) {
          sameDaySkipReason = "buildReminderRow returned null";
          console.log(`[same-day] skip: ${sameDaySkipReason}`);
        } else {
          sameDayInvoked = true;
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
    } else if (result.handled) {
      sameDaySkipReason = `op=${result.op}, not upsert`;
    } else {
      sameDaySkipReason = `handler bailed: ${result.reason}`;
    }

    // Record the breadcrumb — everything we know about this delivery in one
    // record, queryable via GET /debug/webhook-log.
    const data = payload.data as Record<string, unknown> | undefined;
    recordWebhook({
      at,
      event: payload.event,
      action: payload.action,
      workItemId: typeof data?.id === "string" ? data.id : undefined,
      projectId: payload.data ? projectIdOf(payload.data) : undefined,
      hasTargetDate: !!payload.data?.target_date,
      targetDate: payload.data?.target_date ?? null,
      signatureOk: true,
      deliveryId: delivery,
      deduped: false,
      handled: result.handled,
      op: result.handled ? result.op : undefined,
      handlerReason: result.handled ? undefined : result.reason,
      sameDayInvoked,
      sameDaySkipReason,
      payloadDataKeys: data ? Object.keys(data) : [],
    });

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

  if (!result.handled) {
    console.log(
      `[webhook] not handled event=${payload.event} action=${payload.action} reason=${result.reason}`,
    );
    return;
  }

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
