import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maybeSendSameDay } from "../src/cron/sameDay.js";
import { openDb, Store, type ReminderRow } from "../src/db.js";
import type { Senders } from "../src/senders/index.js";

function makeStore(): Store {
  const db = openDb(":memory:") as unknown as Database.Database;
  return new Store(db);
}

function fakeSenders() {
  const sendPush = vi.fn(async () => ({ invalidTokens: [] as string[] }));
  const sendEmail = vi.fn(async () => {});
  const senders: Senders = { sendPush, sendEmail };
  return { senders, sendPush, sendEmail };
}

function reminderRow(over: Partial<ReminderRow> = {}): ReminderRow {
  return {
    work_item_id: "wi-1",
    project_id: "p-1",
    name: "Ship the feature",
    target_date: "2026-07-14",
    url: "https://plane.example/acme/projects/p-1/issues/wi-1",
    dedup_hash: "hash",
    updated_at: "2026-07-14T00:00:00.000Z",
    ...over,
  };
}

// A fixed instant that resolves to 2026-07-14 in UTC.
const NOW = new Date("2026-07-14T09:00:00.000Z");

describe("maybeSendSameDay", () => {
  let store: Store;
  beforeEach(() => {
    store = makeStore();
    // One device so dispatch actually attempts a push.
    store.upsertDevice("ExponentPushToken[abc]");
  });

  it("fires exactly one push when target_date equals today in the given tz", async () => {
    const { senders, sendPush } = fakeSenders();
    const sent = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(
      ["ExponentPushToken[abc]"],
      expect.objectContaining({
        title: "Due today: Ship the feature",
        data: expect.objectContaining({
          kind: "same-day",
          workItemId: "wi-1",
          date: "2026-07-14",
        }),
      }),
    );
  });

  it("is idempotent: a second call the same day does NOT resend", async () => {
    const { senders, sendPush } = fakeSenders();
    await maybeSendSameDay(reminderRow(), { store, senders, now: NOW, tz: "UTC" });
    const secondSent = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(secondSent).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("does NOT send when target_date is not today", async () => {
    const { senders, sendPush } = fakeSenders();
    const sent = await maybeSendSameDay(
      reminderRow({ target_date: "2026-07-20" }),
      { store, senders, now: NOW, tz: "UTC" },
    );
    expect(sent).toBe(false);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("does NOT send when target_date is null", async () => {
    const { senders, sendPush } = fakeSenders();
    const sent = await maybeSendSameDay(reminderRow({ target_date: null }), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(sent).toBe(false);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("compares only the date part of full ISO timestamps", async () => {
    const { senders, sendPush } = fakeSenders();
    const sent = await maybeSendSameDay(
      reminderRow({ target_date: "2026-07-14T23:00:00Z" }),
      { store, senders, now: NOW, tz: "UTC" },
    );
    expect(sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("resends on a NEW day for the same item (new offsetKey)", async () => {
    const { senders, sendPush } = fakeSenders();
    // Day 1 → send once.
    await maybeSendSameDay(reminderRow(), { store, senders, now: NOW, tz: "UTC" });
    // Day 2 → target moved to that new date; same item; new offsetKey.
    const day2 = new Date("2026-07-15T09:00:00.000Z");
    const secondSent = await maybeSendSameDay(
      reminderRow({ target_date: "2026-07-15" }),
      { store, senders, now: day2, tz: "UTC" },
    );
    expect(secondSent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(2);
  });
});
