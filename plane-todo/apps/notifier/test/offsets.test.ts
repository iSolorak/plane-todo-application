import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDb, Store, type ReminderRow } from "../src/db.js";
import { runOffsetReminders, shouldFire } from "../src/cron/offsets.js";
import { resolveTargetInstant } from "../src/time.js";
import type { PushMessage, PushResult, Senders } from "../src/senders/index.js";

const DEVICE = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";

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

function seed(store: Store, target: string | null): void {
  const row: ReminderRow = {
    work_item_id: "wi1",
    project_id: "p1",
    name: "Ship it",
    target_date: target,
    url: "https://plane.test/acme/projects/p1/issues/wi1",
    dedup_hash: "hash",
    updated_at: new Date().toISOString(),
  };
  store.upsertReminder(row);
}

const TARGET = "2026-07-10";
const UTC = "UTC";
const oneHour = { key: "1h", minutesBefore: 60 };
const oneDay = { key: "1d", minutesBefore: 1440 };

// In UTC the date-only TARGET anchors to 2026-07-10T23:59:59Z.
//   1h fireTime = 2026-07-10T22:59:59Z
//   1d fireTime = 2026-07-09T23:59:59Z

// -----------------------------------------------------------------------------
// resolveTargetInstant — tz-aware end-of-day anchor incl. DST boundaries
// -----------------------------------------------------------------------------

describe("resolveTargetInstant (tz-aware end-of-day anchor)", () => {
  it("anchors a date-only value to 23:59:59 LOCAL, not UTC midnight", () => {
    // Athens in July is EEST (UTC+3): 23:59:59 local → 20:59:59Z.
    expect(
      new Date(resolveTargetInstant("2026-07-10", "Europe/Athens")!).toISOString(),
    ).toBe("2026-07-10T20:59:59.000Z");
    // UTC: end-of-day is 23:59:59Z.
    expect(new Date(resolveTargetInstant("2026-07-10", "UTC")!).toISOString()).toBe(
      "2026-07-10T23:59:59.000Z",
    );
  });

  it("shifts the instant across the spring DST boundary (Europe/Athens)", () => {
    // Before DST (EET, UTC+2): 23:59:59 local → 21:59:59Z.
    const beforeDst = resolveTargetInstant("2026-03-15", "Europe/Athens")!;
    // After DST starts 2026-03-29 (EEST, UTC+3): 23:59:59 local → 20:59:59Z.
    const afterDst = resolveTargetInstant("2026-03-30", "Europe/Athens")!;

    expect(new Date(beforeDst).toISOString()).toBe("2026-03-15T21:59:59.000Z");
    expect(new Date(afterDst).toISOString()).toBe("2026-03-30T20:59:59.000Z");
    // Same wall-clock end-of-day, but the UTC offset moved by exactly one hour.
    expect((beforeDst % 86_400_000) - (afterDst % 86_400_000)).toBe(3_600_000);
  });

  it("shifts the instant across the autumn DST boundary (Europe/Athens)", () => {
    // Still DST (EEST, UTC+3) → 20:59:59Z.
    const duringDst = resolveTargetInstant("2026-10-24", "Europe/Athens")!;
    // After DST ends 2026-10-25 (EET, UTC+2) → 21:59:59Z.
    const afterDst = resolveTargetInstant("2026-10-26", "Europe/Athens")!;

    expect(new Date(duringDst).toISOString()).toBe("2026-10-24T20:59:59.000Z");
    expect(new Date(afterDst).toISOString()).toBe("2026-10-26T21:59:59.000Z");
    expect((afterDst % 86_400_000) - (duringDst % 86_400_000)).toBe(3_600_000);
  });

  it("parses a full ISO timestamp as-is and returns null for junk", () => {
    expect(
      new Date(resolveTargetInstant("2026-07-10T09:30:00.000Z", UTC)!).toISOString(),
    ).toBe("2026-07-10T09:30:00.000Z");
    expect(resolveTargetInstant(null, UTC)).toBeNull();
    expect(resolveTargetInstant("not-a-date", UTC)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// shouldFire — eligibility (fire window + bounded catch-up)
// -----------------------------------------------------------------------------

describe("shouldFire (window + catch-up)", () => {
  const row = { work_item_id: "wi1", target_date: TARGET } as ReminderRow;

  it("fires once now is in [fireTime, targetInstant)", () => {
    const now = Date.parse("2026-07-10T23:10:00.000Z"); // after 1h fireTime, <target
    expect(shouldFire(row, oneHour, now, UTC, 0)).toBe(true);
  });

  it("does NOT fire before the fire window opens", () => {
    const now = Date.parse("2026-07-10T22:00:00.000Z"); // before 22:59:59 fireTime
    expect(shouldFire(row, oneHour, now, UTC, 0)).toBe(false);
  });

  it("does NOT fire once the deadline has passed", () => {
    const now = Date.parse("2026-07-11T00:05:00.000Z");
    expect(shouldFire(row, oneHour, now, UTC, 0)).toBe(false);
  });

  it("drops a still-open offset when closer than minCatchup to the deadline", () => {
    const now = Date.parse("2026-07-10T23:45:00.000Z"); // ~15m before 23:59:59
    expect(shouldFire(row, oneHour, now, UTC, 30 * 60_000)).toBe(false);
    // …but fires if catch-up threshold is 0.
    expect(shouldFire(row, oneHour, now, UTC, 0)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// runOffsetReminders — end-to-end with mocked clock + senders
// -----------------------------------------------------------------------------

describe("runOffsetReminders", () => {
  let store: Store;
  let senders: ReturnType<typeof mockSenders>;

  beforeEach(() => {
    store = new Store(openDb(":memory:"));
    store.upsertDevice(DEVICE);
    senders = mockSenders();
  });

  it("sends and records sent_log when the window is open", async () => {
    seed(store, TARGET);
    const now = new Date("2026-07-10T23:10:00.000Z");

    await runOffsetReminders({ store, offsets: [oneHour], senders, tz: UTC, now });

    expect(senders.sendPush).toHaveBeenCalledTimes(1);
    expect(senders.sendEmail).toHaveBeenCalledTimes(1);
    expect(senders.sendPush).toHaveBeenCalledWith(
      [DEVICE],
      expect.objectContaining({ title: expect.stringContaining("1h") }),
    );
    expect(store.isSent("wi1", "1h")).toBe(true);
  });

  it("does NOT resend on a second run (sent_log guards send-once)", async () => {
    seed(store, TARGET);
    const now = new Date("2026-07-10T23:10:00.000Z");

    await runOffsetReminders({ store, offsets: [oneHour], senders, tz: UTC, now });
    await runOffsetReminders({ store, offsets: [oneHour], senders, tz: UTC, now });

    expect(senders.sendPush).toHaveBeenCalledTimes(1);
    expect(senders.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("skips an offset already present in sent_log", async () => {
    seed(store, TARGET);
    store.markSent("wi1", "1h", "2026-07-10T23:00:00.000Z");
    const now = new Date("2026-07-10T23:10:00.000Z");

    await runOffsetReminders({ store, offsets: [oneHour], senders, tz: UTC, now });

    expect(senders.sendPush).not.toHaveBeenCalled();
    expect(senders.sendEmail).not.toHaveBeenCalled();
  });

  it("does not send before the window opens", async () => {
    seed(store, TARGET);
    const now = new Date("2026-07-10T22:00:00.000Z"); // before 1h fireTime

    await runOffsetReminders({ store, offsets: [oneHour], senders, tz: UTC, now });

    expect(senders.sendPush).not.toHaveBeenCalled();
    expect(store.isSent("wi1", "1h")).toBe(false);
  });

  // (a) BOUNDED CATCH-UP: created long after the 1d fireTime but still well
  // before the deadline → fires exactly once.
  it("catches up a missed offset when >minCatchup before the deadline", async () => {
    seed(store, TARGET);
    // 1d fireTime was 2026-07-09T23:59:59Z; now is a full half-day later.
    const now = new Date("2026-07-10T12:00:00.000Z");

    await runOffsetReminders({ store, offsets: [oneDay], senders, tz: UTC, now });

    expect(senders.sendPush).toHaveBeenCalledTimes(1);
    expect(store.isSent("wi1", "1d")).toBe(true);
  });

  // (b) same missed offset, but the deadline is now imminent (<minCatchup) →
  // dropped as noise.
  it("drops a missed offset when <minCatchup before the deadline", async () => {
    seed(store, TARGET);
    // ~20 min before the 23:59:59Z deadline — under the default 30-min floor.
    const now = new Date("2026-07-10T23:40:00.000Z");

    await runOffsetReminders({ store, offsets: [oneDay], senders, tz: UTC, now });

    expect(senders.sendPush).not.toHaveBeenCalled();
    expect(store.isSent("wi1", "1d")).toBe(false);
  });

  it("fires independently per offset key", async () => {
    seed(store, TARGET);
    const now = new Date("2026-07-10T23:10:00.000Z"); // both 1d and 1h windows open

    await runOffsetReminders({
      store,
      offsets: [oneDay, oneHour],
      senders,
      tz: UTC,
      now,
    });

    expect(senders.sendPush).toHaveBeenCalledTimes(2);
    expect(store.isSent("wi1", "1d")).toBe(true);
    expect(store.isSent("wi1", "1h")).toBe(true);
  });

  it("anchors end-of-day in the configured tz (Europe/Athens)", async () => {
    seed(store, TARGET);
    // Athens EEST deadline is 2026-07-10T20:59:59Z. At 21:30Z the local day is
    // already over, so nothing fires (UTC-midnight anchoring would mis-handle).
    const past = new Date("2026-07-10T21:30:00.000Z");
    await runOffsetReminders({
      store,
      offsets: [oneHour],
      senders,
      tz: "Europe/Athens",
      now: past,
    });
    expect(senders.sendPush).not.toHaveBeenCalled();

    // At 20:30Z (30 min before the Athens deadline) the 1h window is open.
    const inWindow = new Date("2026-07-10T20:30:00.000Z");
    await runOffsetReminders({
      store,
      offsets: [oneHour],
      senders,
      tz: "Europe/Athens",
      now: inWindow,
      minCatchupMinutes: 0,
    });
    expect(senders.sendPush).toHaveBeenCalledTimes(1);
  });
});
