import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maybeSendSameDay } from "../src/cron/sameDay.js";
import { openDb, Store, type ReminderRow } from "../src/db.js";
import type { PushResult, Senders } from "../src/senders/index.js";

function makeStore(): Store {
  const db = openDb(":memory:") as unknown as Database.Database;
  return new Store(db);
}

/** Build a PushResult where every token was accepted (the happy path). */
function acceptedResult(tokenCount: number): PushResult {
  return {
    attempted: tokenCount,
    accepted: tokenCount,
    ticketErrors: [],
    invalidTokens: [],
    chunkErrors: [],
  };
}

function fakeSenders(pushResult: PushResult = acceptedResult(1)) {
  const sendPush = vi.fn(async () => pushResult);
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

const NOW = new Date("2026-07-14T09:00:00.000Z");

describe("maybeSendSameDay", () => {
  let store: Store;
  beforeEach(() => {
    store = makeStore();
    // One registered device so dispatch has something to push to.
    store.upsertDevice("ExponentPushToken[abc]");
  });

  it("fires exactly one push when target_date equals today in the given tz", async () => {
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(result.sent).toBe(true);
    if (result.sent) {
      expect(result.dispatch.tokenCount).toBe(1);
      expect(result.dispatch.push?.accepted).toBe(1);
    }
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
    const second = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(second.sent).toBe(false);
    if (!second.sent) expect(second.reason).toContain("already sent");
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("does NOT send when target_date is not today", async () => {
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(
      reminderRow({ target_date: "2026-07-20" }),
      { store, senders, now: NOW, tz: "UTC" },
    );
    expect(result.sent).toBe(false);
    if (!result.sent) expect(result.reason).toMatch(/!=/);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("does NOT send when target_date is null", async () => {
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(reminderRow({ target_date: null }), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(result.sent).toBe(false);
    if (!result.sent) expect(result.reason).toContain("no target_date");
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("compares only the date part of full ISO timestamps", async () => {
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(
      reminderRow({ target_date: "2026-07-14T23:00:00Z" }),
      { store, senders, now: NOW, tz: "UTC" },
    );
    expect(result.sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("resends on a NEW day for the same item (new offsetKey)", async () => {
    const { senders, sendPush } = fakeSenders();
    await maybeSendSameDay(reminderRow(), { store, senders, now: NOW, tz: "UTC" });
    const day2 = new Date("2026-07-15T09:00:00.000Z");
    const second = await maybeSendSameDay(
      reminderRow({ target_date: "2026-07-15" }),
      { store, senders, now: day2, tz: "UTC" },
    );
    expect(second.sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(2);
  });

  it("does NOT mark sent when 0 pushes are accepted (retryable)", async () => {
    // sendPush returns 0 accepted (e.g. Expo API down or token was invalid).
    const failing: PushResult = {
      attempted: 1,
      accepted: 0,
      ticketErrors: ["mock: expo returned error"],
      invalidTokens: [],
      chunkErrors: [],
    };
    const { senders, sendPush } = fakeSenders(failing);
    const result = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(result.sent).toBe(true); // attempt was made
    if (result.sent) expect(result.dispatch.push?.accepted).toBe(0);

    // Because nothing was accepted, the sent_log is NOT written — a follow-up
    // call the same day gets another chance.
    const second = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
    });
    expect(second.sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(2);
  });
});
