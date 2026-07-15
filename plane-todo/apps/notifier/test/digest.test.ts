import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDb, Store, type ReminderRow } from "../src/db.js";
import { runDigest, ymdInTz } from "../src/cron/digest.js";
import type { PushMessage, PushResult, Senders } from "../src/senders/index.js";

const OK_PUSH: PushResult = {
  attempted: 1,
  accepted: 1,
  ticketErrors: [],
  invalidTokens: [],
  chunkErrors: [],
};

function mockSenders() {
  return {
    sendPush: vi.fn(async (_tokens: string[], _message: PushMessage) => OK_PUSH),
    sendEmail: vi.fn(async (_subject: string, _text: string) => {}),
  } satisfies Senders & {
    sendPush: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
  };
}

function seed(store: Store, id: string, target: string): void {
  const row: ReminderRow = {
    work_item_id: id,
    project_id: "p1",
    name: `Item ${id}`,
    target_date: target,
    url: `https://plane.test/acme/projects/p1/issues/${id}`,
    dedup_hash: "h",
    updated_at: new Date().toISOString(),
  };
  store.upsertReminder(row);
}

describe("ymdInTz", () => {
  it("resolves the local date in the given timezone", () => {
    // 22:30Z is 01:30 next day in Athens (UTC+3 in summer).
    const d = new Date("2026-07-09T22:30:00.000Z");
    expect(ymdInTz(d, "Europe/Athens")).toBe("2026-07-10");
    expect(ymdInTz(d, "UTC")).toBe("2026-07-09");
  });
});

describe("runDigest", () => {
  let store: Store;
  let senders: ReturnType<typeof mockSenders>;

  beforeEach(() => {
    store = new Store(openDb(":memory:"));
    store.upsertDevice("ExponentPushToken[dddddddddddddddddddddd]");
    senders = mockSenders();
  });

  it("sends ONE push + ONE email summarizing today's items", async () => {
    seed(store, "wi1", "2026-07-10");
    seed(store, "wi2", "2026-07-10");
    seed(store, "wi3", "2026-07-11"); // not today
    const now = new Date("2026-07-10T05:00:00.000Z");

    await runDigest({ store, senders, now, tz: "UTC" });

    expect(senders.sendPush).toHaveBeenCalledTimes(1);
    expect(senders.sendEmail).toHaveBeenCalledTimes(1);
    const [, message] = senders.sendPush.mock.calls[0]!;
    expect(message.title).toContain("(2)");
  });

  it("is idempotent for the same day (digest:<date> guard)", async () => {
    seed(store, "wi1", "2026-07-10");
    const now = new Date("2026-07-10T05:00:00.000Z");

    await runDigest({ store, senders, now, tz: "UTC" });
    await runDigest({ store, senders, now, tz: "UTC" });

    expect(senders.sendPush).toHaveBeenCalledTimes(1);
    expect(store.isSent("__digest__", "digest:2026-07-10")).toBe(true);
  });

  it("sends nothing when no items are due today", async () => {
    seed(store, "wi1", "2026-07-11");
    const now = new Date("2026-07-10T05:00:00.000Z");

    await runDigest({ store, senders, now, tz: "UTC" });

    expect(senders.sendPush).not.toHaveBeenCalled();
    expect(senders.sendEmail).not.toHaveBeenCalled();
  });
});
