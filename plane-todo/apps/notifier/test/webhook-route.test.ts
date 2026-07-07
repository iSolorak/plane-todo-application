import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../src/config.js";
import { openDb, Store } from "../src/db.js";
import { buildServer } from "../src/server.js";

const SECRET = "top-secret";

function makeEnv(): AppEnv {
  return {
    planeBaseUrl: "https://plane.test",
    planeWorkspaceSlug: "acme",
    planeApiKey: "k",
    planeProjectIds: ["p1"],
    planeWebhookSecret: SECRET,
    smtp: {},
    tz: "UTC",
    port: 3005,
    dbPath: ":memory:",
    configPath: "./config.json",
  };
}

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function post(
  app: FastifyInstance,
  body: string,
  headers: Record<string, string>,
) {
  return app.inject({
    method: "POST",
    url: "/webhooks/plane",
    headers: { "content-type": "application/json", ...headers },
    payload: body,
  });
}

const ISSUE_BODY = JSON.stringify({
  event: "issue",
  action: "created",
  data: {
    id: "wi1",
    name: "Ship it",
    project_id: "p1",
    target_date: "2026-07-10",
  },
});

describe("webhook route: logging + debug", () => {
  let store: Store;
  let app: FastifyInstance;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    store = new Store(openDb(":memory:"));
    app = buildServer({ store, env: makeEnv() });
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    await app.close();
  });

  it("processes a valid delivery and logs the upsert branch", async () => {
    const res = await post(app, ISSUE_BODY, {
      "x-plane-signature": sign(ISSUE_BODY),
      "x-plane-delivery": "d1",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, op: "upsert" });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[webhook] issue created wi1 "Ship it"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("target_date=2026-07-10 → mirror upserted"),
    );
    expect(store.listReminders()).toHaveLength(1);
  });

  it("rejects an invalid signature with 401 and logs the rejection", async () => {
    const res = await post(app, ISSUE_BODY, {
      "x-plane-signature": "deadbeef",
      "x-plane-delivery": "d2",
    });

    expect(res.statusCode).toBe(401);
    expect(warnSpy).toHaveBeenCalledWith(
      "[webhook] rejected: invalid signature (delivery=d2)",
    );
    // Mirror is untouched on a rejected delivery.
    expect(store.listReminders()).toHaveLength(0);
  });

  it("logs '?' for a rejected delivery with no delivery header", async () => {
    const res = await post(app, ISSUE_BODY, { "x-plane-signature": "nope" });
    expect(res.statusCode).toBe(401);
    expect(warnSpy).toHaveBeenCalledWith(
      "[webhook] rejected: invalid signature (delivery=?)",
    );
  });

  it("logs the duplicate-delivery skip", async () => {
    const headers = {
      "x-plane-signature": sign(ISSUE_BODY),
      "x-plane-delivery": "dup",
    };
    await post(app, ISSUE_BODY, headers);
    const res = await post(app, ISSUE_BODY, headers);

    expect(res.json()).toMatchObject({ deduped: true });
    expect(logSpy).toHaveBeenCalledWith(
      "[webhook] duplicate delivery dup — skipped",
    );
  });

  it("logs ignored non-issue events", async () => {
    const body = JSON.stringify({ event: "cycle", action: "created" });
    const res = await post(app, body, {
      "x-plane-signature": sign(body),
      "x-plane-delivery": "d3",
    });

    expect(res.statusCode).toBe(200);
    expect(logSpy).toHaveBeenCalledWith(
      "[webhook] ignored event=cycle action=created",
    );
  });

  it("logs the delete branch when target_date is removed", async () => {
    const body = JSON.stringify({
      event: "issue",
      action: "updated",
      data: { id: "wi1", name: "Ship it", project_id: "p1", target_date: null },
    });
    const res = await post(app, body, {
      "x-plane-signature": sign(body),
      "x-plane-delivery": "d4",
    });

    expect(res.json()).toMatchObject({ op: "delete" });
    expect(logSpy).toHaveBeenCalledWith(
      "[webhook] issue updated wi1 → mirror row removed",
    );
  });

  it("serves /debug/reminders with the mirror rows in non-production", async () => {
    await post(app, ISSUE_BODY, {
      "x-plane-signature": sign(ISSUE_BODY),
      "x-plane-delivery": "seed",
    });

    const res = await app.inject({ method: "GET", url: "/debug/reminders" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        work_item_id: "wi1",
        name: "Ship it",
        target_date: "2026-07-10",
        project_id: "p1",
        updated_at: expect.any(String),
      },
    ]);
  });

  it("does not mount /debug/reminders in production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const prodApp = buildServer({ store, env: makeEnv() });
    try {
      const res = await prodApp.inject({
        method: "GET",
        url: "/debug/reminders",
      });
      expect(res.statusCode).toBe(404);
    } finally {
      process.env.NODE_ENV = prev;
      await prodApp.close();
    }
  });
});
