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

  it("is idempotent for redelivered/unrelated-field webhooks on a same-day item", async () => {
    // Real-world flow: 1st webhook creates the item today (no prior state) →
    // fires. 2nd webhook is an unrelated edit — target_date is still today,
    // and prior state was also today → transition guard blocks the re-fire.
    const { senders, sendPush } = fakeSenders();
    await maybeSendSameDay(reminderRow(), { store, senders, now: NOW, tz: "UTC" });
    const second = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
      previousTargetDate: "2026-07-14", // stored state is today after the first webhook
    });
    expect(second.sent).toBe(false);
    if (!second.sent) expect(second.reason).toContain("no transition");
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

  it("fires on a fresh-create (no previousTargetDate)", async () => {
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
      // previousTargetDate omitted -> undefined -> treated as fresh create
    });
    expect(result.sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("SKIPS when the item was already due today before the webhook", async () => {
    // Simulates: user edits an unrelated field (name/description) on an item
    // whose target_date was already today. We should NOT re-notify.
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
      previousTargetDate: "2026-07-14", // same as today in UTC
    });
    expect(result.sent).toBe(false);
    if (!result.sent) expect(result.reason).toContain("no transition");
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("FIRES when target_date transitions FROM another day TO today", async () => {
    // Simulates: user edits due date from tomorrow → today.
    const { senders, sendPush } = fakeSenders();
    const result = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
      previousTargetDate: "2026-07-20",
    });
    expect(result.sent).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("FIRES again on re-transition after date moved AWAY then back to today", async () => {
    // Simulates: 1) create today (fires + marks sent),
    //           2) user moves date to tomorrow (no fire),
    //           3) user moves back to today (should fire again).
    const { senders, sendPush } = fakeSenders();
    // Step 1: fresh create → fires + marks sent for this date.
    await maybeSendSameDay(reminderRow(), { store, senders, now: NOW, tz: "UTC" });
    expect(sendPush).toHaveBeenCalledTimes(1);
    // Step 2: (no same-day call because target_date isn't today; skipped upstream.)
    // Step 3: another transition today. Prior state was tomorrow.
    const result = await maybeSendSameDay(reminderRow(), {
      store,
      senders,
      now: NOW,
      tz: "UTC",
      previousTargetDate: "2026-07-20",
    });
    expect(result.sent).toBe(true);
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
