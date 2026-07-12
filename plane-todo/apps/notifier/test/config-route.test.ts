import { describe, it, expect } from "vitest";
import type { AppEnv, ReminderConfig } from "../src/config.js";
import { openDb, Store } from "../src/db.js";
import { buildServer } from "../src/server.js";

function makeEnv(): AppEnv {
  return {
    planeBaseUrl: "https://plane.test",
    planeWorkspaceSlug: "acme",
    planeApiKey: "k",
    planeProjectIds: ["p1"],
    planeWebhookSecret: "s",
    smtp: {},
    tz: "UTC",
    port: 3005,
    dbPath: ":memory:",
    configPath: "./config.json",
  };
}

const REMINDER_CONFIG: ReminderConfig = {
  offsets: [{ key: "1d", minutesBefore: 1440 }],
  digest: { enabled: true, time: "08:00", tz: "Europe/Athens" },
  minCatchupMinutes: 30,
};

describe("GET /config", () => {
  it("returns the read-only offsets + digest when configured", async () => {
    const store = new Store(openDb(":memory:"));
    const app = buildServer({
      store,
      env: makeEnv(),
      reminderConfig: REMINDER_CONFIG,
    });
    try {
      const res = await app.inject({ method: "GET", url: "/config" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        offsets: [{ key: "1d", minutesBefore: 1440 }],
        digest: { enabled: true, time: "08:00", tz: "Europe/Athens" },
        minCatchupMinutes: 30,
      });
    } finally {
      await app.close();
    }
  });

  it("is not mounted when no reminderConfig is provided", async () => {
    const store = new Store(openDb(":memory:"));
    const app = buildServer({ store, env: makeEnv() });
    try {
      const res = await app.inject({ method: "GET", url: "/config" });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
